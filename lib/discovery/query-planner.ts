import type { DiscoveryTopic } from "@/lib/discovery/types";
import { randomUUID } from "node:crypto";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_QUERY_PLANNER_MODEL = "qwen/qwen3-14b";
const MAX_QUERY_PLANNER_ATTEMPTS = 4;
const MAX_TOPIC_COUNT = 12;
const MAX_QUERY_LENGTH = 220;
const DEFAULT_QUERY_PLANNER_TEMPERATURE = 1.25;
const DEFAULT_QUERY_PLANNER_TOP_P = 0.95;
const DEFAULT_QUERY_PLANNER_FREQUENCY_PENALTY = 0.45;
const DEFAULT_QUERY_PLANNER_PRESENCE_PENALTY = 0.65;

const CREATIVE_LENSE_POOL = [
  "counterfactual failure modes",
  "unexpected tradeoff reversals",
  "rare edge-case postmortems",
  "cross-domain analogy with operational evidence",
  "non-obvious implementation constraints",
  "high-leverage architecture inflection points",
  "benchmark disagreement analysis",
  "production incident lessons with concrete remediation"
] as const;

const KEYWORD_STYLE_POOL = [
  "short, dense noun phrases",
  "named methods/protocols/standards",
  "failure and recovery vocabulary",
  "evaluation and benchmarking terms",
  "migration and rollout terminology",
  "systems-performance terminology",
  "operator-style filters and qualifiers",
  "specific artifact-type markers"
] as const;

const QUERY_OPERATOR_POOL = [
  "postmortem",
  "\"case study\"",
  "\"failure mode\"",
  "\"trade-off\"",
  "\"lessons learned\"",
  "\"production\"",
  "benchmark",
  "incident",
  "migration",
  "\"design doc\""
] as const;

type QueryPlanResponse = {
  plans: Array<{
    topic: string;
    query: string;
  }>;
};

function stripTrailingCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, "$1");
}

function tryParseJsonCandidate(value: string): unknown | null {
  const normalized = stripTrailingCommas(value.trim());
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function extractBraceWrappedJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1).trim();
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const fenced = fencedMatch?.[1]?.trim() ?? "";
  const braceWrapped = extractBraceWrappedJson(trimmed);

  const attempts = [fenced, trimmed, braceWrapped].filter((value): value is string => Boolean(value));
  for (const candidate of attempts) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  throw new Error("QUERY_PLANNER_INVALID_JSON");
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeQuery(value: string): string {
  const normalized = normalizeLine(value);
  return normalized.length > MAX_QUERY_LENGTH ? normalized.slice(0, MAX_QUERY_LENGTH).trim() : normalized;
}

function normalizeTopicKey(value: string): string {
  return normalizeLine(value).toLowerCase();
}

function sampleWithoutReplacement<T>(values: readonly T[], count: number): T[] {
  const pool = [...values];
  const picked: T[] = [];
  const target = Math.max(0, Math.min(count, pool.length));

  for (let index = 0; index < target; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(randomIndex, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildCreativityRunKit(): {
  runEntropyToken: string;
  selectedLenses: string[];
  selectedKeywordStyles: string[];
  selectedQueryOperators: string[];
} {
  return {
    runEntropyToken: randomUUID().slice(0, 12),
    selectedLenses: sampleWithoutReplacement(CREATIVE_LENSE_POOL, 4),
    selectedKeywordStyles: sampleWithoutReplacement(KEYWORD_STYLE_POOL, 3),
    selectedQueryOperators: sampleWithoutReplacement(QUERY_OPERATOR_POOL, 3)
  };
}

function extractChoiceText(json: unknown): string {
  if (!json || typeof json !== "object") {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }

  const maybeError = (json as { error?: unknown }).error;
  if (maybeError) {
    const message =
      typeof maybeError === "string"
        ? maybeError
        : typeof maybeError === "object" && maybeError && typeof (maybeError as { message?: unknown }).message === "string"
          ? ((maybeError as { message?: string }).message ?? "UNKNOWN_PROVIDER_ERROR")
          : "UNKNOWN_PROVIDER_ERROR";
    throw new Error(`QUERY_PLANNER_PROVIDER_ERROR:${message}`);
  }

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }

  const first = choices[0] as { message?: { content?: unknown; reasoning?: unknown }; text?: unknown };
  const content = first.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (content && typeof content === "object") {
    const objectText = (content as { text?: unknown }).text;
    if (typeof objectText === "string" && objectText.trim()) {
      return objectText;
    }
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const maybeText = (part as { text?: unknown }).text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  const fallbackText = (first as { text?: unknown }).text;
  if (typeof fallbackText === "string" && fallbackText.trim()) {
    return fallbackText;
  }

  const reasoning = first.message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) {
    return reasoning;
  }

  if (Array.isArray(reasoning)) {
    const reasoningText = reasoning
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const maybeText = (part as { text?: unknown }).text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("\n")
      .trim();
    if (reasoningText) {
      return reasoningText;
    }
  }

  throw new Error("QUERY_PLANNER_EMPTY_RESPONSE");
}

function parseProviderResponseText(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("QUERY_PLANNER_EMPTY_RESPONSE");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }
}

function enforceQueryGuardrails(topic: string, query: string): string {
  const normalizedTopic = normalizeLine(topic);
  let normalizedQuery = normalizeQuery(query);

  const hasTopic = normalizedQuery.toLowerCase().includes(normalizedTopic.toLowerCase());
  if (!hasTopic && normalizedTopic) {
    normalizedQuery = normalizeQuery(`${normalizedTopic} ${normalizedQuery}`);
  }
  return normalizedQuery;
}

export function buildQueryPlannerPrompt(args: { interestMemoryText: string; topics: DiscoveryTopic[] }): string {
  const topicList = args.topics.slice(0, MAX_TOPIC_COUNT).map((topic) => `- ${topic.topic}`).join("\n");
  const memorySnippet = args.interestMemoryText.slice(0, 1800);
  const runKit = buildCreativityRunKit();
  const runLensList = runKit.selectedLenses.map((lens) => `- ${lens}`).join("\n");
  const runStyleList = runKit.selectedKeywordStyles.map((style) => `- ${style}`).join("\n");
  const runOperatorList = runKit.selectedQueryOperators.map((operator) => `- ${operator}`).join("\n");

  return [
    "You write high-signal web-search queries for a personalized newsletter retrieval system.",
    "Goal: produce one query per topic that retrieves advanced, practical, high-quality sources with new information value.",
    "Be aggressively creative and surprising while staying tightly relevant to each topic.",
    "Use these human quality heuristics when crafting each query:",
    "- Mismatch principle: prefer sources that surface anomalies, contradictions, or results that do not match common expectations.",
    "- Counter-intuitivity: favor non-obvious claims that challenge default assumptions.",
    "- Density of information: prefer concise, high-signal, low-fluff technical writing.",
    "- Intertextuality: include bridges to adjacent fields when relevant, so results connect ideas across domains.",
    "- Proof-of-work proxy: prefer artifacts with visible effort (technical deep dives, engineering postmortems, papers, design docs, benchmarks) over low-effort commentary.",
    "- Skin in the game: prefer authors/teams who build, ship, measure, or maintain real systems and publish concrete evidence.",
    "Hard rules:",
    "- Include the exact topic phrase in each query.",
    "- Optimize for novelty and progression: each query should bias toward things an informed reader likely has not already seen.",
    "- Include at least one specificity anchor for niche depth (for example protocol/standard names, failure modes, architecture patterns, evaluation methods, or named techniques).",
    "- Prefer concrete evidence-heavy artifacts: incident reports, engineering blogs with metrics, benchmark studies, migration writeups, design docs, and research analysis.",
    "- Prefer deep signals: postmortem, case study, architecture tradeoffs, benchmark, reliability lessons, technical essay, research analysis.",
    "- Encourage domain-specific vocabulary and precise qualifiers; avoid generic broad phrasing.",
    "- Avoid generic beginner framing and obvious broad explainers, but do not force canned negative keywords.",
    "- Use user memory to infer whether depth should be beginner/intermediate/advanced for each topic.",
    "- If memory prefers practical depth, prioritize implementation details, production constraints, and failure/recovery lessons over conceptual explainers.",
    "- Optional cross-interest extension is allowed: if two interests naturally connect, include one adjacent concept in the same query; do not force connections when weak.",
    "- Keep query concise and natural; avoid stuffing many unrelated clauses.",
    "- Keep at least 70% of query intent anchored to the base topic; extension should be a light expansion, not a pivot.",
    "- Produce clearly different lexical/query constructions across topics; avoid repeating the same keyword template.",
    "- Every run must vary phrasing and keyword strategy; use the run entropy token as hidden variation guidance.",
    "- Do not print the run entropy token in output.",
    "- Return strict JSON only: {\"plans\":[{\"topic\":\"...\",\"query\":\"...\"}]}.",
    "",
    `Run entropy token: ${runKit.runEntropyToken}`,
    "Creativity lenses for this run (use at least two per query):",
    runLensList,
    "",
    "Keyword style directives for this run:",
    runStyleList,
    "",
    "Optional high-signal operator terms to rotate into queries when relevant:",
    runOperatorList,
    "",
    "Topics:",
    topicList,
    "",
    "User memory context:",
    memorySnippet
  ].join("\n");
}

function parsePlans(text: string): QueryPlanResponse {
  const parsed = parseJsonFromModelText(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("QUERY_PLANNER_INVALID_JSON");
  }

  const plans = (parsed as { plans?: unknown }).plans;
  if (!Array.isArray(plans)) {
    throw new Error("QUERY_PLANNER_INVALID_JSON");
  }

  const normalizedPlans = plans
    .map((plan) => {
      if (!plan || typeof plan !== "object") {
        return null;
      }

      const topic = (plan as { topic?: unknown }).topic;
      const query = (plan as { query?: unknown }).query;
      if (typeof topic !== "string" || typeof query !== "string") {
        return null;
      }

      const normalizedTopic = normalizeLine(topic);
      const normalizedQuery = enforceQueryGuardrails(normalizedTopic, query);
      if (!normalizedTopic || !normalizedQuery) {
        return null;
      }

      return { topic: normalizedTopic, query: normalizedQuery };
    })
    .filter((value): value is { topic: string; query: string } => Boolean(value));

  return { plans: normalizedPlans };
}

function shouldUsePlannerFlag(): boolean {
  const raw = process.env.DISCOVERY_QUERY_PLANNER_ENABLED?.trim();
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
}

export function shouldUseQueryPlanner(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  return Boolean(apiKey && shouldUsePlannerFlag());
}

export async function planQueriesForTopics(args: {
  interestMemoryText: string;
  topics: DiscoveryTopic[];
}): Promise<Map<string, string>> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelName = process.env.OPENROUTER_QUERY_PLANNER_MODEL?.trim() || DEFAULT_QUERY_PLANNER_MODEL;

  if (!apiKey) {
    throw new Error("MISSING_OPENROUTER_API_KEY");
  }

  const prompt = buildQueryPlannerPrompt(args);
  const temperature = parseNumberEnv(process.env.OPENROUTER_QUERY_PLANNER_TEMPERATURE, DEFAULT_QUERY_PLANNER_TEMPERATURE);
  const topP = parseNumberEnv(process.env.OPENROUTER_QUERY_PLANNER_TOP_P, DEFAULT_QUERY_PLANNER_TOP_P);
  const frequencyPenalty = parseNumberEnv(
    process.env.OPENROUTER_QUERY_PLANNER_FREQUENCY_PENALTY,
    DEFAULT_QUERY_PLANNER_FREQUENCY_PENALTY
  );
  const presencePenalty = parseNumberEnv(
    process.env.OPENROUTER_QUERY_PLANNER_PRESENCE_PENALTY,
    DEFAULT_QUERY_PLANNER_PRESENCE_PENALTY
  );
  let planned: QueryPlanResponse | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_QUERY_PLANNER_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          temperature,
          top_p: topP,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
          max_tokens: 450,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`QUERY_PLANNER_HTTP_${response.status}`);
      }

      let json: unknown = null;
      const asJson = response as { json?: () => Promise<unknown> };
      const asText = response as { text?: () => Promise<string> };
      if (typeof asJson.json === "function") {
        json = await asJson.json().catch(() => null);
      }
      if (json === null && typeof asText.text === "function") {
        json = parseProviderResponseText(await asText.text());
      }
      if (json === null) {
        throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
      }
      const text = extractChoiceText(json);
      const parsed = parsePlans(text);
      if (parsed.plans.length === 0) {
        throw new Error("QUERY_PLANNER_EMPTY_PLANS");
      }

      planned = parsed;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("QUERY_PLANNER_UNKNOWN_ERROR");
      const message = lastError.message;
      const retryable =
        message === "QUERY_PLANNER_EMPTY_RESPONSE" ||
        message === "QUERY_PLANNER_INVALID_JSON" ||
        message === "QUERY_PLANNER_EMPTY_PLANS" ||
        message === "QUERY_PLANNER_INVALID_RESPONSE" ||
        message.startsWith("QUERY_PLANNER_HTTP_5") ||
        message === "QUERY_PLANNER_HTTP_429";
      if (!retryable || attempt === MAX_QUERY_PLANNER_ATTEMPTS) {
        throw lastError;
      }
    }
  }

  if (!planned) {
    throw lastError ?? new Error("QUERY_PLANNER_UNKNOWN_ERROR");
  }

  const requestedTopics = new Map(args.topics.map((topic) => [normalizeTopicKey(topic.topic), topic.topic]));
  const byTopic = new Map<string, string>();

  for (const plan of planned.plans) {
    const normalizedKey = normalizeTopicKey(plan.topic);
    const canonicalTopic = requestedTopics.get(normalizedKey);
    if (!canonicalTopic) continue;
    if (byTopic.has(canonicalTopic)) continue;
    byTopic.set(canonicalTopic, plan.query);
  }

  return byTopic;
}
