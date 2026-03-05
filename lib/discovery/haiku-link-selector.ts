import type { ExaSearchResult } from "@/lib/discovery/types";
import {
  callAnthropicCompatibleTextModel,
  readFirstEnv,
  requireFirstEnv
} from "@/lib/ai/text-model-client";

type DiscoveryBrief = {
  reinforceTopics: string[];
  avoidPatterns: string[];
  preferredAngles: string[];
  noveltyMoves: string[];
};

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function parseSelectedIndex(text: string, max: number): number | null {
  try {
    const parsed = parseJsonFromModelText(text);
    if (parsed && typeof parsed === "object") {
      const selectedIndex = (parsed as { selected_index?: unknown }).selected_index;

      if (selectedIndex === null) {
        return null;
      }

      if (typeof selectedIndex === "string" && selectedIndex.trim().toUpperCase() === "NULL") {
        return null;
      }

      if (typeof selectedIndex === "number" && Number.isFinite(selectedIndex)) {
        if (selectedIndex >= 1 && selectedIndex <= max) {
          return Math.trunc(selectedIndex) - 1;
        }

        if (selectedIndex >= 0 && selectedIndex < max) {
          return Math.trunc(selectedIndex);
        }
      }
    }
  } catch {
    // Allow legacy integer-only outputs as fallback while migrating prompt contract.
  }

  const match = text.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return null;
  return parsed - 1;
}

function buildSelectorSystemPrompt(): string {
  return [
    "You are a senior research curator selecting one article for a personalized newsletter discovery pipeline.",
    "Your job is to choose the single candidate with the strongest topic fit and evidence density.",
    "Be skeptical of hype, thin abstraction, and title-only appeal.",
    "Return only the requested JSON decision."
  ].join("\n");
}

function buildSelectorPrompt(args: {
  topic: string;
  interestMemoryText: string;
  discoveryBrief?: DiscoveryBrief;
  candidates: ExaSearchResult[];
  alreadySelected: Array<{ topic: string; title: string }>;
}): string {
  const items = args.candidates
    .map((candidate, index) => {
      const title = candidate.title?.trim() || "Untitled";
      const excerpt = candidate.excerpt?.trim() || candidate.highlights?.[0]?.trim() || "-";
      const clippedExcerpt = excerpt.length > 320 ? `${excerpt.slice(0, 320)}...` : excerpt;
      return `${index + 1}. ${title} || ${candidate.url}\n   Excerpt: ${clippedExcerpt}`;
    })
    .join("\n");
  const alreadySelectedText =
    args.alreadySelected.length > 0
      ? args.alreadySelected.map((item, index) => `${index + 1}. ${item.topic} || ${item.title}`).join("\n")
      : "(none yet)";
  const discoveryBriefText = args.discoveryBrief
    ? [
        `reinforce_topics=${args.discoveryBrief.reinforceTopics.join(" | ") || "-"}`,
        `avoid_patterns=${args.discoveryBrief.avoidPatterns.join(" | ") || "-"}`,
        `preferred_angles=${args.discoveryBrief.preferredAngles.join(" | ") || "-"}`,
        `novelty_moves=${args.discoveryBrief.noveltyMoves.join(" | ") || "-"}`
      ].join("\n")
    : "(none)";

  return [
    "Task: choose one best candidate link for the topic.",
    "Primary objective: select the candidate with the highest evidence density for the exact topic.",
    "Use the memory/context sections deliberately:",
    "- ACTIVE_INTERESTS = the main living surface of what the reader wants more of. Use this for topic fit and adjacency fit.",
    "- PERSONALITY = durable intellectual/style preferences. Use this for framing, depth, rigor, and what kind of source would actually teach this reader something.",
    "- RECENT_FEEDBACK = short-horizon steering and corrections. Use this to avoid recently downweighted patterns and respect temporary requests without treating them as permanent identity.",
    "- DISCOVERY_BRIEF = optional light-touch guidance for this issue only. Use it only as a tie-breaker or freshness nudge; it should not override the core job of choosing the most substantively valuable candidate.",
    "Evidence density means concrete mechanisms, named systems, quantitative outcomes, incident details, or reproducible implementation steps.",
    "If candidate excerpt is generic trend commentary without concrete evidence, reject it.",
    "Do not reward impressive-sounding titles; choose based on excerpt substance.",
    "Recency is a soft preference, not a hard rule: reject stale items only when they are explicitly time-bound as current/upcoming, and do not penalize older sources when the content is still substantively relevant.",
    "Hard reject rules:",
    "- reject SEO/listicle/beginner/thin pages",
    "- reject weak evidence with no concrete detail",
    "- reject off-topic pages",
    "- reject logistics-first pages (event listings, seminar/workshop pages, schedules, registration/application pages, CFP/job/funding announcements, generic institute/about pages)",
    "- reject pages where primary content is admin details rather than substantive analysis",
    "Reader-value requirement:",
    "- prefer candidates with concrete teachable content in excerpt (finding/mechanism/tradeoff/failure mode/result/framework)",
    "- return NULL unless at least one candidate has both clear topic relevance and at least one concrete teachable unit in excerpt text",
    "Prefer signals:",
    "- postmortems, benchmarks, migration reports, design docs, first-hand implementation notes, and research analysis",
    "- concrete numbers, failure modes, tradeoffs, and constraints",
    "- if two candidates are similarly relevant, prefer the one with clearer concrete evidence over broader trend framing",
    "- prefer primary or first-hand sources (original research, official docs, direct reports) over commentary when quality is comparable",
    "- when uncertain between candidates, choose the one with lower hype language and higher specificity",
    "- if DISCOVERY_BRIEF suggests freshness or angle variation, apply that only after topic fit and evidence density are already satisfied",
    "Tie-break: if two are close, prefer the one that adds a different angle from already selected items.",
    "Output strict JSON only with this shape:",
    '{"selected_index": <1-based integer or "NULL">}',
    "",
    `Topic: ${args.topic}`,
    "User memory:",
    args.interestMemoryText.slice(0, 800),
    "",
    "Discovery brief:",
    discoveryBriefText,
    "",
    "Already selected items in this issue:",
    alreadySelectedText,
    "",
    "Candidates:",
    items
  ].join("\n");
}

export async function selectBestTopicLink(args: {
  topic: string;
  interestMemoryText: string;
  discoveryBrief?: DiscoveryBrief;
  candidates: ExaSearchResult[];
  alreadySelected?: Array<{ topic: string; title: string }>;
}): Promise<number | null> {
  const modelName = requireFirstEnv(
    [
      "OPENROUTER_LINK_SELECTOR_MODEL",
      "OPENROUTER_SUMMARY_MODEL",
      "OPENROUTER_MEMORY_MODEL",
      "ANTHROPIC_LINK_SELECTOR_MODEL",
      "ANTHROPIC_SUMMARY_MODEL",
      "ANTHROPIC_MEMORY_MODEL"
    ],
    "MISSING_ANTHROPIC_SELECTOR_MODEL"
  );
  const fallbackModel = readFirstEnv([
    "ANTHROPIC_LINK_SELECTOR_MODEL",
    "ANTHROPIC_SUMMARY_MODEL",
    "ANTHROPIC_MEMORY_MODEL"
  ]);

  if (args.candidates.length === 0) {
    return null;
  }

  const text = await callAnthropicCompatibleTextModel({
    model: modelName,
    fallbackModel,
    systemPrompt: buildSelectorSystemPrompt(),
    userPrompt: buildSelectorPrompt({
      ...args,
      alreadySelected: args.alreadySelected ?? []
    }),
    maxTokens: 120,
    temperature: 0,
    missingApiKeyError: "MISSING_ANTHROPIC_API_KEY",
    invalidResponseError: "INVALID_SELECTOR_RESPONSE",
    emptyResponseError: "EMPTY_SELECTOR_RESPONSE",
    httpErrorPrefix: "ANTHROPIC_SELECTOR_HTTP_"
  });
  return parseSelectedIndex(text, args.candidates.length);
}
