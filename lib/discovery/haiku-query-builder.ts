import {
  callAnthropicCompatibleTextModel,
  readFirstEnv,
  requireFirstEnv
} from "@/lib/ai/text-model-client";

const MAX_QUERY_LENGTH = 140;
const MIN_QUERY_LENGTH = 12;
const QUERY_BUILDER_TEMPERATURE = 0.85;

type DiscoveryBrief = {
  reinforceTopics: string[];
  avoidPatterns: string[];
  preferredAngles: string[];
  noveltyMoves: string[];
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildSystemPrompt(): string {
  return [
    "You are a senior research librarian generating exactly one web-search query for a discovery pipeline.",
    "Return a single-line query string only.",
    "Be very creative, niche, and surprising in your angle selection.",
    "You have broad leeway to choose framing, terms, and direction.",
    "Prefer concrete and specific language over generic phrasing when possible.",
    "Use the memory sections deliberately rather than treating them as one undifferentiated blob.",
    "ACTIVE_INTERESTS = the living surface of what the reader wants more of. Use this to decide what subject area or adjacent area to search.",
    "PERSONALITY = durable intellectual/style preferences. Use this to decide lens, depth, framing, and what kind of material would feel genuinely useful.",
    "RECENT_FEEDBACK = short-horizon steering and corrections. Use this to avoid recently downweighted angles and to respect temporary requests without turning them into identity.",
    "DISCOVERY_BRIEF = optional light-touch guidance for this issue only. Use it only to nudge freshness, avoid repetition, or slightly prefer one angle; never let it override clear topic fit from ACTIVE_INTERESTS.",
    "Interpret RECENT_FEEDBACK flags in USER_MEMORY as steering signals:",
    "- '+ [more_like_this] ...' means increase adjacent coverage.",
    "- '- [less_like_this] ...' means reduce or avoid adjacent coverage."
  ].join("\n");
}

function buildUserPrompt(args: {
  topic: string;
  interestMemoryText: string;
  attempt: number;
  referenceDateUtc: string;
  discoveryBrief?: DiscoveryBrief;
}): string {
  const discoveryBriefBlock = args.discoveryBrief
    ? [
        "DISCOVERY_BRIEF:",
        `reinforce_topics=${args.discoveryBrief.reinforceTopics.join(" | ") || "-"}`,
        `avoid_patterns=${args.discoveryBrief.avoidPatterns.join(" | ") || "-"}`,
        `preferred_angles=${args.discoveryBrief.preferredAngles.join(" | ") || "-"}`,
        `novelty_moves=${args.discoveryBrief.noveltyMoves.join(" | ") || "-"}`
      ].join("\n")
    : "DISCOVERY_BRIEF:\n-";

  return [
    `REFERENCE_DATE_UTC: ${args.referenceDateUtc}`,
    `ATTEMPT: ${args.attempt}`,
    `TOPIC: ${args.topic}`,
    "Task guidance:",
    "- Generate one search query that would help the system find a strong article for this topic while staying aligned with the reader's durable profile.",
    "- The query can be direct or intelligently adjacent, but it should stay grounded in what this reader would plausibly find illuminating.",
    "- Prefer queries that surface concrete, substantive material over generic trend coverage.",
    "USER_MEMORY:",
    args.interestMemoryText.slice(0, 1200),
    "",
    discoveryBriefBlock
  ].join("\n");
}

function validateQuery(query: string): { ok: true } | { ok: false; reason: string } {
  if (!query) return { ok: false, reason: "EMPTY_QUERY" };
  if (query.length < MIN_QUERY_LENGTH) return { ok: false, reason: "QUERY_TOO_SHORT" };

  return { ok: true };
}

export async function buildHaikuQuery(args: {
  topic: string;
  interestMemoryText: string;
  discoveryBrief?: DiscoveryBrief;
  attempt: number;
  referenceDateUtc?: Date;
}): Promise<string> {
  const modelName = requireFirstEnv(
    [
      "OPENROUTER_QUERY_BUILDER_MODEL",
      "OPENROUTER_LINK_SELECTOR_MODEL",
      "OPENROUTER_SUMMARY_MODEL",
      "OPENROUTER_MEMORY_MODEL",
      "ANTHROPIC_QUERY_BUILDER_MODEL",
      "ANTHROPIC_LINK_SELECTOR_MODEL",
      "ANTHROPIC_SUMMARY_MODEL",
      "ANTHROPIC_MEMORY_MODEL"
    ],
    "MISSING_ANTHROPIC_QUERY_BUILDER_MODEL"
  );
  const fallbackModel = readFirstEnv([
    "ANTHROPIC_QUERY_BUILDER_MODEL",
    "ANTHROPIC_LINK_SELECTOR_MODEL",
    "ANTHROPIC_SUMMARY_MODEL",
    "ANTHROPIC_MEMORY_MODEL"
  ]);

  const referenceDateUtc = (args.referenceDateUtc ?? new Date()).toISOString();
  const modelText = await callAnthropicCompatibleTextModel({
    model: modelName,
    fallbackModel,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt({
      topic: args.topic,
      interestMemoryText: args.interestMemoryText,
      discoveryBrief: args.discoveryBrief,
      attempt: args.attempt,
      referenceDateUtc
    }),
    maxTokens: 90,
    temperature: QUERY_BUILDER_TEMPERATURE,
    missingApiKeyError: "MISSING_ANTHROPIC_API_KEY",
    invalidResponseError: "INVALID_QUERY_BUILDER_RESPONSE",
    emptyResponseError: "EMPTY_QUERY_BUILDER_RESPONSE",
    httpErrorPrefix: "ANTHROPIC_QUERY_BUILDER_HTTP_"
  });
  const rawQuery = normalizeLine(modelText).replace(/^["'`]+|["'`]+$/g, "");
  const singleLineQuery = rawQuery.split("\n")[0]?.trim() ?? "";
  const query = singleLineQuery.length > MAX_QUERY_LENGTH ? singleLineQuery.slice(0, MAX_QUERY_LENGTH).trim() : singleLineQuery;
  const validation = validateQuery(query);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  return query;
}
