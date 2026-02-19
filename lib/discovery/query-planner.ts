import type { DiscoveryTopic } from "@/lib/discovery/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_QUERY_PLANNER_MODEL = "qwen/qwen3-14b";
const MAX_TOPIC_COUNT = 12;
const MAX_QUERY_LENGTH = 220;
const MIN_PLANNER_TEMPERATURE = 0.75;
const MAX_PLANNER_TEMPERATURE = 1.05;
const RECENCY_OPERATORS = [
  "last 7 days",
  "last 30 days",
  "last 90 days",
  "last 12 months",
  "since previous year"
] as const;
const CREATIVITY_LENSES = [
  "anomaly hunt",
  "counter-example excavation",
  "failed approach autopsy",
  "operational edge-case stress",
  "unpopular technique spotlight",
  "history-repeat pattern match",
  "under-discussed implementation tradeoff",
  "negative-result signal"
] as const;
const STYLE_DIRECTIVES = [
  "use one uncommon but domain-valid phrase",
  "blend one reliability keyword with one research keyword",
  "bias toward concrete artifact words over abstract framing",
  "favor crisp verb-led phrasing over noun stacks",
  "include one production constraint marker",
  "inject one contradiction connector (for example: despite, fails when, breaks under)"
] as const;
const HIGH_SIGNAL_OPERATORS = [
  "postmortem",
  "benchmark",
  "migration",
  "incident",
  "tradeoff",
  "failure mode",
  "design doc",
  "evaluation protocol"
] as const;

type QueryPlanResponse = {
  plans: Array<{
    topic: string;
    query: string;
  }>;
};
type QueryPlannerRunKit = {
  runEntropyToken: string;
  runLensList: string;
  runStyleList: string;
  runOperatorList: string;
  recencyByTopicKey: Map<string, string>;
};

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

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
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

function stripFence(text: string): string {
  const fencedMatch = text.trim().match(/```(?:text|txt|md|markdown)?\s*([\s\S]*?)\s*```/i);
  return (fencedMatch?.[1] ?? text).trim();
}

function stripLinePrefix(line: string): string {
  return line
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+[\).\]:-]?\s+/, "")
    .replace(/^\s*query\s*\d*\s*[:\-]\s*/i, "")
    .trim();
}

function sampleList(values: readonly string[], token: string, count: number): string[] {
  const desiredCount = Math.max(1, Math.min(count, values.length));
  const start = hashString(token) % values.length;
  const selected: string[] = [];

  for (let i = 0; i < desiredCount; i += 1) {
    selected.push(values[(start + i) % values.length] ?? values[0]);
  }

  return selected;
}

function parseQueries(text: string): string[] {
  const stripped = stripFence(text);
  return stripped
    .split("\n")
    .map((line) => stripLinePrefix(line))
    .filter(Boolean)
    .map((line) => line.replace(/^["'`]|["'`]$/g, "").trim());
}

function buildRunKit(topics: DiscoveryTopic[]): QueryPlannerRunKit {
  const runEntropyToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const runLensList = sampleList(CREATIVITY_LENSES, `${runEntropyToken}:lens`, 3).join(", ");
  const runStyleList = sampleList(STYLE_DIRECTIVES, `${runEntropyToken}:style`, 3).join(", ");
  const runOperatorList = sampleList(HIGH_SIGNAL_OPERATORS, `${runEntropyToken}:op`, 4).join(", ");

  const recencyByTopicKey = new Map<string, string>();
  const recencyStart = hashString(`${runEntropyToken}:recency`) % RECENCY_OPERATORS.length;
  topics.slice(0, MAX_TOPIC_COUNT).forEach((topic, index) => {
    const key = normalizeTopicKey(topic.topic);
    recencyByTopicKey.set(key, RECENCY_OPERATORS[(recencyStart + index) % RECENCY_OPERATORS.length] ?? RECENCY_OPERATORS[0]);
  });

  return { runEntropyToken, runLensList, runStyleList, runOperatorList, recencyByTopicKey };
}

function enforceQueryGuardrails(topic: string, query: string, recencyOperator: string): string {
  const normalizedTopic = normalizeLine(topic);
  let normalizedQuery = normalizeQuery(query);

  const hasTopic = normalizedQuery.toLowerCase().includes(normalizedTopic.toLowerCase());
  if (!hasTopic && normalizedTopic) {
    normalizedQuery = normalizeQuery(`${normalizedTopic} ${normalizedQuery}`);
  }

  if (recencyOperator) {
    const lower = normalizedQuery.toLowerCase();
    const hasRecency = RECENCY_OPERATORS.some((operator) => lower.includes(operator.toLowerCase()));
    if (!hasRecency) {
      normalizedQuery = normalizeQuery(`${normalizedQuery} ${recencyOperator}`);
    }
  }

  return normalizedQuery;
}

export function buildQueryPlannerPrompt(args: {
  interestMemoryText: string;
  topics: DiscoveryTopic[];
  runKit?: QueryPlannerRunKit;
}): string {
  const runKit = args.runKit ?? buildRunKit(args.topics);
  const topicList = args.topics.slice(0, MAX_TOPIC_COUNT).map((topic) => `- ${topic.topic}`).join("\n");
  const memorySnippet = args.interestMemoryText.slice(0, 900);

  return [
    "Write one web-search query per topic for exploratory newsletter discovery.",
    "Be wild and surprising, but stay inside the topic's field.",
    "Requirements:",
    "- Include the exact topic phrase.",
    "- Include one recency phrase: last 7 days, last 30 days, last 90 days, last 12 months, or since previous year.",
    "- Bias toward high-signal evidence (postmortems, benchmarks, incident writeups, migration notes, design docs, technical analysis).",
    "- Prefer non-obvious, contrarian, or edge-case angles over generic explainers.",
    "- Keep at least 70% of intent anchored to the topic; adjacent extensions are allowed but must stay relevant.",
    "- Vary lexical strategy across topics in this run; avoid repeating one template.",
    "- Use run entropy token and run directives as hidden variation control; never print them.",
    "- Output queries only, one per line, same order as Topics. No JSON, bullets, numbering, labels, or commentary.",
    "",
    `Run entropy token: ${runKit.runEntropyToken}`,
    "Run creativity lenses:",
    runKit.runLensList,
    "",
    "Run style directives:",
    runKit.runStyleList,
    "",
    "Run operator hints:",
    runKit.runOperatorList,
    "",
    "Topics:",
    topicList,
    "",
    "User memory context:",
    memorySnippet
  ].join("\n");
}

function parsePlans(args: {
  text: string;
  topics: DiscoveryTopic[];
  recencyByTopicKey: Map<string, string>;
}): QueryPlanResponse {
  const queries = parseQueries(args.text);
  if (queries.length === 0) {
    throw new Error("QUERY_PLANNER_INVALID_RESPONSE");
  }

  const planned = args.topics.slice(0, MAX_TOPIC_COUNT).map((topic, index) => {
    const query = queries[index];
    if (!query) return null;

    const recencyOperator = args.recencyByTopicKey.get(normalizeTopicKey(topic.topic)) ?? RECENCY_OPERATORS[0];
    const normalizedTopic = normalizeLine(topic.topic);
    const normalizedQuery = enforceQueryGuardrails(normalizedTopic, query, recencyOperator);
    if (!normalizedTopic || !normalizedQuery) return null;

    return { topic: normalizedTopic, query: normalizedQuery };
  });

  return { plans: planned.filter((item): item is { topic: string; query: string } => Boolean(item)) };
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

  const runKit = buildRunKit(args.topics);
  const prompt = buildQueryPlannerPrompt({
    interestMemoryText: args.interestMemoryText,
    topics: args.topics,
    runKit
  });
  const temperatureSeed = hashString(runKit.runEntropyToken) % 1000;
  const temperature = MIN_PLANNER_TEMPERATURE + (temperatureSeed / 1000) * (MAX_PLANNER_TEMPERATURE - MIN_PLANNER_TEMPERATURE);
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature,
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
  const planned = parsePlans({
    text,
    topics: args.topics,
    recencyByTopicKey: runKit.recencyByTopicKey
  });

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
