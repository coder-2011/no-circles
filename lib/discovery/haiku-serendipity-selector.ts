import {
  callAnthropicCompatibleTextModel,
  readFirstEnv,
  requireFirstEnv
} from "@/lib/ai/text-model-client";

const DEFAULT_SERENDIPITY_TOPIC_COUNT = 2;

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

function normalizeTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

function buildMemoryContext(interestMemoryText: string): string {
  const personalityMatch = interestMemoryText.match(/PERSONALITY:\s*([\s\S]*?)(?:\n\s*ACTIVE_INTERESTS:|\n\s*RECENT_FEEDBACK:|$)/i);
  const feedbackMatch = interestMemoryText.match(/RECENT_FEEDBACK:\s*([\s\S]*?)$/i);

  const personality = personalityMatch?.[1]?.trim() || "-";
  const recentFeedback = feedbackMatch?.[1]?.trim() || "-";

  return [
    "PERSONALITY:",
    personality,
    "",
    "RECENT_FEEDBACK:",
    recentFeedback
  ].join("\n");
}

function buildSystemPrompt(): string {
  return [
    "You are a senior cross-domain editor designing the serendipity lane for a personalized newsletter.",
    "Your job is to propose adjacent topics that broaden the reader's lens without drifting into random or low-value territory.",
    "Favor substantive, teachable adjacent areas over vague trend buckets.",
    "Return only the requested JSON."
  ].join("\n");
}

function buildPrompt(args: {
  activeTopics: string[];
  interestMemoryText: string;
  discoveryBrief?: DiscoveryBrief;
  maxTopics: number;
}): string {
  const discoveryBriefText = args.discoveryBrief
    ? [
        `reinforce_topics=${args.discoveryBrief.reinforceTopics.join(" | ") || "-"}`,
        `avoid_patterns=${args.discoveryBrief.avoidPatterns.join(" | ") || "-"}`,
        `preferred_angles=${args.discoveryBrief.preferredAngles.join(" | ") || "-"}`,
        `novelty_moves=${args.discoveryBrief.noveltyMoves.join(" | ") || "-"}`
      ].join("\n")
    : "(none)";

  return [
    "Task: choose adjacent serendipity topics to complement the active-interest set.",
    "Use the explicit Active interests list as the primary source for what the reader actively wants coverage on today.",
    "Use PERSONALITY to infer learning style, abstraction level, and what kinds of adjacent topics will feel naturally interesting rather than random.",
    "Use RECENT_FEEDBACK to expand toward recently reinforced directions and avoid adjacent areas that would repeat a downweighted theme.",
    "Use DISCOVERY_BRIEF as a crucial freshness/control layer for repetition avoidance and lens variation.",
    "Do not infer active topics from the memory context block below; the active-topic authority is the explicit Active interests list.",
    "Pick topics that are adjacent to active interests but not duplicates of active interests.",
    "Keep the topics at the same level of specificity as the active interests.",
    "Choose high-value topics likely to yield concrete sources (not generic trend buckets).",
    "Interpret RECENT_FEEDBACK flags in User memory:",
    "- '+ [more_like_this] ...' means include adjacent expansion themes.",
    "- '- [less_like_this] ...' means avoid adjacent themes that reinforce that item/topic.",
    "Return JSON only with exactly this shape:",
    '{"topics":["topic 1","topic 2"]}',
    "",
    `Max topics to return: ${args.maxTopics}`,
    "Active interests:",
    ...args.activeTopics.map((topic, index) => `${index + 1}. ${topic}`),
    "",
    "Discovery brief:",
    discoveryBriefText,
    "",
    "Memory context (non-active sections only):",
    buildMemoryContext(args.interestMemoryText).slice(0, 1200)
  ].join("\n");
}

function parseSelectedTopics(args: {
  text: string;
  activeTopics: string[];
  maxTopics: number;
}): string[] {
  const parsed = parseJsonFromModelText(args.text);
  if (!parsed || typeof parsed !== "object") return [];

  const topics = (parsed as { topics?: unknown }).topics;
  if (!Array.isArray(topics)) return [];

  const activeSet = new Set(args.activeTopics.map((topic) => topic.toLowerCase()));
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const raw of topics) {
    if (typeof raw !== "string") continue;
    const normalized = normalizeTopic(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (key.length < 3) continue;
    if (activeSet.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(normalized);
    if (selected.length >= args.maxTopics) break;
  }
  return selected;
}

export async function selectSerendipityTopics(args: {
  activeTopics: string[];
  interestMemoryText: string;
  discoveryBrief?: DiscoveryBrief;
  maxTopics?: number;
}): Promise<string[]> {
  const maxTopics = Math.max(1, Math.floor(args.maxTopics ?? DEFAULT_SERENDIPITY_TOPIC_COUNT));
  if (args.activeTopics.length === 0) return [];

  const modelName = requireFirstEnv(
    [
      "OPENROUTER_SERENDIPITY_MODEL",
      "OPENROUTER_LINK_SELECTOR_MODEL",
      "OPENROUTER_SUMMARY_MODEL",
      "OPENROUTER_MEMORY_MODEL",
      "ANTHROPIC_SERENDIPITY_MODEL",
      "ANTHROPIC_LINK_SELECTOR_MODEL",
      "ANTHROPIC_SUMMARY_MODEL",
      "ANTHROPIC_MEMORY_MODEL"
    ],
    "MISSING_ANTHROPIC_SERENDIPITY_MODEL"
  );
  const fallbackModel = readFirstEnv([
    "ANTHROPIC_SERENDIPITY_MODEL",
    "ANTHROPIC_LINK_SELECTOR_MODEL",
    "ANTHROPIC_SUMMARY_MODEL",
    "ANTHROPIC_MEMORY_MODEL"
  ]);

  // No deterministic topic synthesis fallback: caller can continue without serendipity lane.
  try {
    const text = await callAnthropicCompatibleTextModel({
      model: modelName,
      fallbackModel,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildPrompt({
        activeTopics: args.activeTopics,
        interestMemoryText: args.interestMemoryText,
        discoveryBrief: args.discoveryBrief,
        maxTopics
      }),
      maxTokens: 140,
      temperature: 0.85,
      missingApiKeyError: "MISSING_ANTHROPIC_API_KEY",
      invalidResponseError: "INVALID_SERENDIPITY_SELECTOR_RESPONSE",
      emptyResponseError: "EMPTY_SERENDIPITY_SELECTOR_RESPONSE",
      httpErrorPrefix: "ANTHROPIC_SERENDIPITY_SELECTOR_HTTP_"
    });
    const selected = parseSelectedTopics({
      text,
      activeTopics: args.activeTopics,
      maxTopics
    });

    return selected;
  } catch {
    return [];
  }
}
