import type { ExaSearchResult } from "@/lib/discovery/types";

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_SELECTOR_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_SELECTOR_RESPONSE");
  }

  const text = content
    .filter((chunk): chunk is { type: string; text: string } => {
      if (!chunk || typeof chunk !== "object") return false;
      const candidate = chunk as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string";
    })
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("EMPTY_SELECTOR_RESPONSE");
  }

  return text;
}

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

function buildSelectorPrompt(args: {
  topic: string;
  interestMemoryText: string;
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

  return [
    "Task: choose one best candidate link for the topic.",
    "Primary objective: select the candidate with the highest evidence density for the exact topic.",
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
    "Tie-break: if two are close, prefer the one that adds a different angle from already selected items.",
    "Output strict JSON only with this shape:",
    '{"selected_index": <1-based integer or "NULL">, "rationale": "<max 30 words>"}',
    "",
    `Topic: ${args.topic}`,
    "User memory:",
    args.interestMemoryText.slice(0, 800),
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
  candidates: ExaSearchResult[];
  alreadySelected?: Array<{ topic: string; title: string }>;
}): Promise<number | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName =
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL?.trim() ||
    process.env.ANTHROPIC_SUMMARY_MODEL?.trim() ||
    process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }

  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_SELECTOR_MODEL");
  }

  if (args.candidates.length === 0) {
    return null;
  }

  const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 120,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: buildSelectorPrompt({
            ...args,
            alreadySelected: args.alreadySelected ?? []
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_SELECTOR_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const text = extractTextContent(json);
  return parseSelectedIndex(text, args.candidates.length);
}
