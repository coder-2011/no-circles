const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_SERENDIPITY_TOPIC_COUNT = 2;

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_SERENDIPITY_SELECTOR_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_SERENDIPITY_SELECTOR_RESPONSE");
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
    throw new Error("EMPTY_SERENDIPITY_SELECTOR_RESPONSE");
  }

  return text;
}

function normalizeTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

function buildPrompt(args: {
  activeTopics: string[];
  suppressedTopics: string[];
  interestMemoryText: string;
  maxTopics: number;
}): string {
  return [
    "Task: choose adjacent serendipity topics to complement the active-interest set.",
    "Pick topics that are adjacent to active interests but not duplicates of active interests.",
    "Prioritize breadth: the selected topics should add distinct lenses, not near-duplicates of each other.",
    "Choose only high-value topics likely to yield concrete, substantive sources (not generic trend buckets).",
    "Reject vague meta-topics and reject topics that are too far from the active-interest context.",
    "Return JSON only with exactly this shape:",
    '{"topics":["topic 1","topic 2"],"rationale":"<max 40 words>"}',
    "",
    `Max topics to return: ${args.maxTopics}`,
    "Active interests:",
    ...args.activeTopics.map((topic, index) => `${index + 1}. ${topic}`),
    "",
    "Suppressed interests (never propose these):",
    ...(args.suppressedTopics.length > 0
      ? args.suppressedTopics.map((topic, index) => `${index + 1}. ${topic}`)
      : ["(none)"]),
    "",
    "User memory (context and constraints):",
    args.interestMemoryText.slice(0, 1200)
  ].join("\n");
}

function parseSelectedTopics(args: {
  text: string;
  activeTopics: string[];
  suppressedTopics: string[];
  maxTopics: number;
}): string[] {
  const parsed = parseJsonFromModelText(args.text);
  if (!parsed || typeof parsed !== "object") return [];

  const topics = (parsed as { topics?: unknown }).topics;
  if (!Array.isArray(topics)) return [];

  const activeSet = new Set(args.activeTopics.map((topic) => topic.toLowerCase()));
  const suppressedSet = new Set(args.suppressedTopics.map((topic) => topic.toLowerCase()));
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const raw of topics) {
    if (typeof raw !== "string") continue;
    const normalized = normalizeTopic(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (key.length < 3) continue;
    if (activeSet.has(key) || suppressedSet.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(normalized);
    if (selected.length >= args.maxTopics) break;
  }
  return selected;
}

export async function selectSerendipityTopics(args: {
  activeTopics: string[];
  suppressedTopics: string[];
  interestMemoryText: string;
  maxTopics?: number;
}): Promise<string[]> {
  const maxTopics = Math.max(1, Math.floor(args.maxTopics ?? DEFAULT_SERENDIPITY_TOPIC_COUNT));
  if (args.activeTopics.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName =
    process.env.ANTHROPIC_SERENDIPITY_MODEL?.trim() ||
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL?.trim() ||
    process.env.ANTHROPIC_SUMMARY_MODEL?.trim() ||
    process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  // No deterministic topic synthesis fallback: caller can continue without serendipity lane.
  if (!apiKey || !modelName) {
    return [];
  }

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 140,
        temperature: 0.85,
        messages: [
          {
            role: "user",
              content: buildPrompt({
                activeTopics: args.activeTopics,
                suppressedTopics: args.suppressedTopics,
                interestMemoryText: args.interestMemoryText,
                maxTopics
              })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`ANTHROPIC_SERENDIPITY_SELECTOR_HTTP_${response.status}`);
    }

    const json = (await response.json().catch(() => null)) as unknown;
    const text = extractTextContent(json);
    const selected = parseSelectedTopics({
      text,
      activeTopics: args.activeTopics,
      suppressedTopics: args.suppressedTopics,
      maxTopics
    });

    return selected;
  } catch {
    return [];
  }
}
