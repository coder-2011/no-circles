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

function parseSelectedIndex(text: string, max: number): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return null;
  return parsed - 1;
}

function buildSelectorPrompt(args: { topic: string; interestMemoryText: string; candidates: ExaSearchResult[] }): string {
  const items = args.candidates
    .map((candidate, index) => {
      const title = candidate.title?.trim() || "Untitled";
      const excerpt = candidate.excerpt?.trim() || candidate.highlights?.[0]?.trim() || "-";
      const clippedExcerpt = excerpt.length > 320 ? `${excerpt.slice(0, 320)}...` : excerpt;
      return `${index + 1}. ${title} || ${candidate.url}\n   Excerpt: ${clippedExcerpt}`;
    })
    .join("\n");

  return [
    "Pick the single best link for this topic.",
    "Criteria: relevance to topic, practical depth, novelty, and source quality.",
    "Weight title relevance heavily, but use the excerpt to avoid shallow picks.",
    "Output only one integer index from the candidate list (for example: 3).",
    "",
    `Topic: ${args.topic}`,
    "User memory:",
    args.interestMemoryText.slice(0, 800),
    "",
    "Candidates:",
    items
  ].join("\n");
}

export async function selectBestTopicLink(args: {
  topic: string;
  interestMemoryText: string;
  candidates: ExaSearchResult[];
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
      max_tokens: 20,
      temperature: 0,
      messages: [{ role: "user", content: buildSelectorPrompt(args) }]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_SELECTOR_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const text = extractTextContent(json);
  return parseSelectedIndex(text, args.candidates.length);
}
