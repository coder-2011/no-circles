const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const MAX_QUERY_LENGTH = 140;
const MIN_QUERY_LENGTH = 12;
const QUERY_BUILDER_TEMPERATURE = 0.85;

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_QUERY_BUILDER_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_QUERY_BUILDER_RESPONSE");
  }

  const text = content
    .filter((chunk): chunk is { type: string; text: string } => {
      if (!chunk || typeof chunk !== "object") return false;
      const candidate = chunk as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string";
    })
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) {
    throw new Error("EMPTY_QUERY_BUILDER_RESPONSE");
  }

  return text;
}

function buildSystemPrompt(): string {
  return [
    "You are a senior research librarian generating exactly one web-search query for a discovery pipeline.",
    "Return a single-line query string only.",
    "Be very creative, niche, and surprising in your angle selection.",
    "You have broad leeway to choose framing, terms, and direction.",
    "Prefer concrete and specific language over generic phrasing when possible.",
    "Interpret RECENT_FEEDBACK flags in USER_MEMORY as steering signals:",
    "- '+ [more_like_this] ...' means increase adjacent coverage.",
    "- '- [less_like_this] ...' means reduce or avoid adjacent coverage."
  ].join("\n");
}

function buildUserPrompt(args: { topic: string; interestMemoryText: string; attempt: number; referenceDateUtc: string }): string {
  return [
    `REFERENCE_DATE_UTC: ${args.referenceDateUtc}`,
    `ATTEMPT: ${args.attempt}`,
    `TOPIC: ${args.topic}`,
    "USER_MEMORY:",
    args.interestMemoryText.slice(0, 1200)
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
  attempt: number;
  referenceDateUtc?: Date;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName =
    process.env.ANTHROPIC_QUERY_BUILDER_MODEL?.trim() ||
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL?.trim() ||
    process.env.ANTHROPIC_SUMMARY_MODEL?.trim() ||
    process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) throw new Error("MISSING_ANTHROPIC_API_KEY");
  if (!modelName) throw new Error("MISSING_ANTHROPIC_QUERY_BUILDER_MODEL");

  const referenceDateUtc = (args.referenceDateUtc ?? new Date()).toISOString();
  const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 90,
      temperature: QUERY_BUILDER_TEMPERATURE,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            topic: args.topic,
            interestMemoryText: args.interestMemoryText,
            attempt: args.attempt,
            referenceDateUtc
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_QUERY_BUILDER_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const rawQuery = normalizeLine(extractTextContent(json)).replace(/^["'`]+|["'`]+$/g, "");
  const singleLineQuery = rawQuery.split("\n")[0]?.trim() ?? "";
  const query = singleLineQuery.length > MAX_QUERY_LENGTH ? singleLineQuery.slice(0, MAX_QUERY_LENGTH).trim() : singleLineQuery;
  const validation = validateQuery(query);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  return query;
}
