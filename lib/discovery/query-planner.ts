import type { DiscoveryTopic } from "@/lib/discovery/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_QUERY_PLANNER_MODEL = "qwen/qwen3-14b";
const MAX_TOPIC_COUNT = 12;
const MAX_QUERY_LENGTH = 220;
const REQUIRED_NEGATIVE_TERMS = ["-tutorial", "-beginner", "-beginners", "-introduction", "-basics", "-101"] as const;

type QueryPlanResponse = {
  plans: Array<{
    topic: string;
    query: string;
  }>;
};

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
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

function extractChoiceText(json: unknown): string {
  if (!json || typeof json !== "object") {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }

  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("QUERY_PLANNER_EMPTY_RESPONSE");
  }

  return content;
}

function enforceQueryGuardrails(topic: string, query: string): string {
  const normalizedTopic = normalizeLine(topic);
  let normalizedQuery = normalizeQuery(query);

  const hasTopic = normalizedQuery.toLowerCase().includes(normalizedTopic.toLowerCase());
  if (!hasTopic && normalizedTopic) {
    normalizedQuery = normalizeQuery(`${normalizedTopic} ${normalizedQuery}`);
  }

  const lower = normalizedQuery.toLowerCase();
  const missingNegativeTerms = REQUIRED_NEGATIVE_TERMS.filter((term) => !lower.includes(term));
  if (missingNegativeTerms.length === 0) {
    return normalizedQuery;
  }

  return normalizeQuery(`${normalizedQuery} ${missingNegativeTerms.join(" ")}`);
}

export function buildQueryPlannerPrompt(args: { interestMemoryText: string; topics: DiscoveryTopic[] }): string {
  const topicList = args.topics.slice(0, MAX_TOPIC_COUNT).map((topic) => `- ${topic.topic}`).join("\n");
  const memorySnippet = args.interestMemoryText.slice(0, 1800);

  return [
    "You write high-signal web-search queries for a personalized newsletter retrieval system.",
    "Goal: produce one query per topic that retrieves advanced, practical, high-quality sources with new information value.",
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
    "- Avoid beginner material and dictionary/index pages.",
    "- Include these negative terms in every query exactly once each: -tutorial -beginner -beginners -introduction -basics -101.",
    "- Use user memory to infer whether depth should be beginner/intermediate/advanced for each topic.",
    "- If memory prefers practical depth, prioritize implementation details, production constraints, and failure/recovery lessons over conceptual explainers.",
    "- Optional cross-interest extension is allowed: if two interests naturally connect, include one adjacent concept in the same query; do not force connections when weak.",
    "- Keep query concise and natural; avoid stuffing many unrelated clauses.",
    "- Keep at least 70% of query intent anchored to the base topic; extension should be a light expansion, not a pivot.",
    "- Return strict JSON only: {\"plans\":[{\"topic\":\"...\",\"query\":\"...\"}]}.",
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
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0,
      max_tokens: 450,
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

  const json = (await response.json().catch(() => null)) as unknown;
  const text = extractChoiceText(json);
  const planned = parsePlans(text);

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
