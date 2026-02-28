import { buildSummaryPrompt, SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/summary-prompts";
import { parseSections } from "@/lib/memory/contract";
import { logInfo, logWarn } from "@/lib/observability/log";
import { summaryWriterOutputSchema } from "@/lib/schemas";

type SummarySourceItem = {
  url: string;
  title: string;
  highlights: string[];
  topic?: string;
  isSerendipitous?: boolean;
};

export type NewsletterSummaryItem = {
  title: string;
  url: string;
  summary: string;
  isSerendipitous?: boolean;
};

type GenerateSummariesInput = {
  items: SummarySourceItem[];
  interestMemoryText?: string;
  targetWords?: number;
  minWords?: number;
  maxWords?: number;
};

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_TARGET_WORDS = 100;
const DEFAULT_WORD_RANGE_DELTA = 20;
const MAX_RETRY_COUNT = 1;
const INSUFFICIENT_SOURCE_DETAIL = "INSUFFICIENT_SOURCE_DETAIL";

type CallSummaryModelArgs = {
  prompt: string;
  systemPrompt: string;
};

type SummarizeOneItemResult = {
  item: NewsletterSummaryItem | null;
  skipped: boolean;
};

const DISALLOWED_SUMMARY_PATTERNS = [
  /^unable to generate summary/i,
  /^no highlights content was provided/i,
  /^the provided highlight contains only/i,
  /^the source material does not include/i
] as const;

function logSummaryEvent(level: "info" | "warn", event: string, details: Record<string, unknown>) {
  if (level === "warn") {
    logWarn("summary_writer", event, details);
    return;
  }

  logInfo("summary_writer", event, details);
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  const text = content
    .filter((chunk): chunk is { type: string; text: string } => {
      if (!chunk || typeof chunk !== "object") {
        return false;
      }

      const candidate = chunk as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string";
    })
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  return text;
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function clampSummaryLength(summary: string, minWords: number, maxWords: number): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  const words = normalized.split(" ");
  if (words.length > maxWords) {
    const truncated = words.slice(0, maxWords).join(" ");
    const sentenceBoundary = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("!"), truncated.lastIndexOf("?"));
    if (sentenceBoundary >= 0) {
      const sentenceTrimmed = truncated.slice(0, sentenceBoundary + 1).trim();
      if (sentenceTrimmed.split(" ").filter(Boolean).length >= minWords) {
        return sentenceTrimmed;
      }
    }

    return truncated.trim();
  }

  if (words.length >= minWords) {
    return normalized;
  }

  return normalized;
}

function isDisallowedSummary(summary: string): boolean {
  const normalized = summary.replace(/\s+/g, " ").trim();
  return DISALLOWED_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isQualityFailure(errorMessage: string): boolean {
  return (
    errorMessage === "SUMMARY_INSUFFICIENT_SOURCE_DETAIL" ||
    errorMessage === "SUMMARY_DISALLOWED_PLACEHOLDER" ||
    errorMessage === "SUMMARY_EMPTY_AFTER_NORMALIZATION"
  );
}

async function callSummaryModel(args: CallSummaryModelArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName = process.env.ANTHROPIC_SUMMARY_MODEL?.trim() || process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }

  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_SUMMARY_OR_MEMORY_MODEL");
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
      max_tokens: 350,
      temperature: 0,
      system: args.systemPrompt,
      messages: [{ role: "user", content: args.prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  return extractTextContent(json);
}

function resolveWordRange(input: GenerateSummariesInput): { minWords: number; maxWords: number } {
  if (typeof input.minWords === "number" && typeof input.maxWords === "number") {
    const minWords = Math.max(1, Math.floor(input.minWords));
    const maxWords = Math.max(minWords, Math.floor(input.maxWords));
    return { minWords, maxWords };
  }

  const targetWords = Math.max(1, Math.floor(input.targetWords ?? DEFAULT_TARGET_WORDS));
  return {
    minWords: Math.max(1, targetWords - DEFAULT_WORD_RANGE_DELTA),
    maxWords: targetWords + DEFAULT_WORD_RANGE_DELTA
  };
}

async function summarizeOneItem(
  item: SummarySourceItem,
  personalitySection: string,
  minWords: number,
  maxWords: number
): Promise<SummarizeOneItemResult> {
  if (item.highlights.length === 0) {
    logSummaryEvent("warn", "summary_skipped_missing_highlights", {
      url: item.url
    });
    return {
      item: null,
      skipped: true
    };
  }

  let lastError = "UNKNOWN_ERROR";

  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    try {
      const prompt = buildSummaryPrompt({
        title: item.title,
        url: item.url,
        highlights: item.highlights,
        topic: item.topic,
        personalitySection,
        minWords,
        maxWords
      });

      const modelText = await callSummaryModel({
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        prompt
      });
      const parsedJson = parseJsonFromModelText(modelText);
      const parsed = summaryWriterOutputSchema.safeParse(parsedJson);

      if (!parsed.success) {
        throw new Error("SUMMARY_SCHEMA_INVALID");
      }

      const summary = clampSummaryLength(parsed.data.summary, minWords, maxWords);
      if (!summary) {
        throw new Error("SUMMARY_EMPTY_AFTER_NORMALIZATION");
      }
      if (summary === INSUFFICIENT_SOURCE_DETAIL) {
        throw new Error("SUMMARY_INSUFFICIENT_SOURCE_DETAIL");
      }
      if (isDisallowedSummary(summary)) {
        throw new Error("SUMMARY_DISALLOWED_PLACEHOLDER");
      }

      return {
        item: {
          title: parsed.data.title || item.title,
          url: item.url,
          summary,
          ...(item.isSerendipitous ? { isSerendipitous: true } : {})
        },
        skipped: false
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      if (attempt === MAX_RETRY_COUNT || isQualityFailure(lastError)) {
        break;
      }
    }
  }

  logSummaryEvent("warn", "summary_skipped_after_model_failure", {
    url: item.url,
    reason: lastError
  });

  return {
    item: null,
    skipped: true
  };
}

export async function generateNewsletterSummaries(input: GenerateSummariesInput): Promise<NewsletterSummaryItem[]> {
  const { minWords, maxWords } = resolveWordRange(input);
  const personalitySection = parseSections(input.interestMemoryText ?? "")?.PERSONALITY.trim() || "-";

  const normalizedItems = input.items.map((item) => ({
    url: item.url,
    title: item.title.trim() || "Untitled",
    highlights: item.highlights.map((highlight) => highlight.trim()).filter(Boolean),
    topic: item.topic?.trim() || undefined,
    isSerendipitous: item.isSerendipitous === true
  }));

  const results: NewsletterSummaryItem[] = [];
  let skippedCount = 0;
  for (const item of normalizedItems) {
    const summaryResult = await summarizeOneItem(item, personalitySection, minWords, maxWords);
    if (summaryResult.skipped || !summaryResult.item) {
      skippedCount += 1;
      continue;
    }
    results.push(summaryResult.item);
  }

  logSummaryEvent("info", "summary_run_complete", {
    item_count: results.length,
    skipped_count: skippedCount
  });

  return results;
}
