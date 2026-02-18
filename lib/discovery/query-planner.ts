import type { DiscoveryTopic } from "@/lib/discovery/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_QUERY_PLANNER_MODEL = "qwen/qwen3-14b";
const MAX_TOPIC_COUNT = 12;
const MAX_QUERY_LENGTH = 220;

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

function buildPrompt(args: { interestMemoryText: string; topics: DiscoveryTopic[] }): string {
  const topicList = args.topics.slice(0, MAX_TOPIC_COUNT).map((topic) => `- ${topic.topic}`).join("\n");
  const memorySnippet = args.interestMemoryText.slice(0, 1800);

  return [
    "You write high-signal web-search queries for a personalized newsletter retrieval system.",
    "Goal: produce one query per topic that retrieves advanced, practical, high-quality sources.",
    "Hard rules:",
    "- Include the exact topic phrase in each query.",
    "- Prefer deep signals: postmortem, case study, architecture tradeoffs, benchmark, reliability lessons, technical essay, research analysis.",
    "- Avoid beginner material and dictionary/index pages.",
    "- Include these negative terms in every query: -tutorial -beginner -beginners -introduction -basics -101.",
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
      const normalizedQuery = normalizeQuery(query);
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

  const prompt = buildPrompt(args);
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
