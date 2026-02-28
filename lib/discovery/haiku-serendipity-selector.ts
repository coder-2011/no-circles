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
  maxTopics: number;
}): string {
  return [
    "Task: choose adjacent serendipity topics to complement the active-interest set.",
    "Use the explicit Active interests list as the primary source for what the reader actively wants coverage on today.",
    "Use PERSONALITY to infer learning style, abstraction level, and what kinds of adjacent topics will feel naturally interesting rather than random.",
    "Use RECENT_FEEDBACK to expand toward recently reinforced directions and avoid adjacent areas that would repeat a downweighted theme.",
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
        system: buildSystemPrompt(),
        messages: [
          {
            role: "user",
              content: buildPrompt({
                activeTopics: args.activeTopics,
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
      maxTopics
    });

    return selected;
  } catch {
    return [];
  }
}
