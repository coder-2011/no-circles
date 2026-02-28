import { z } from "zod";
import { buildQuoteSelectionUserPrompt, QUOTE_SELECTION_SYSTEM_PROMPT } from "@/lib/ai/quote-prompts";
import { parseSections } from "@/lib/memory/contract";
import { logInfo, logWarn } from "@/lib/observability/log";
import { normalizeEnvString } from "@/lib/utils";

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const HF_DATASET_ROWS_API_URL = "https://datasets-server.huggingface.co/rows";

const DEFAULT_DATASET = "jstet/quotes-500k";
const DEFAULT_CONFIG = "default";
const DEFAULT_SPLIT = "train";

const DEFAULT_CANDIDATE_COUNT = 50;
const DEFAULT_SHORTLIST_COUNT = 20;
const DEFAULT_TOTAL_ROWS_ASSUMPTION = 500_000;

const MIN_QUOTE_CHAR_COUNT = 40;
const MAX_QUOTE_CHAR_COUNT = 180;

const FALLBACK_QUOTE = {
  text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.",
  author: "Albert Einstein",
  category: "curiosity"
} as const;

const hfRowsResponseSchema = z.object({
  rows: z.array(
    z.object({
      row_idx: z.number().int().nonnegative(),
      row: z.object({
        quote: z.string(),
        author: z.string(),
        category: z.string().nullable().optional()
      })
    })
  ),
  num_rows_total: z.number().int().positive().optional()
});

const quoteSelectionOutputSchema = z.object({
  selected_index: z.number().int().optional()
});

type QuoteCandidate = {
  rowIndex: number;
  text: string;
  author: string;
  category: string | null;
};

type HfRowsFetchResult = {
  rows: QuoteCandidate[];
  totalRows: number;
};

export type PersonalizedQuote = {
  text: string;
  author: string;
  category: string | null;
  sourceDataset: string;
  rowIndex: number | null;
};

export type SelectPersonalizedQuoteArgs = {
  userId: string;
  localIssueDate: string;
  interestMemoryText: string;
  candidateCount?: number;
  shortlistCount?: number;
};

type SelectPersonalizedQuoteDeps = {
  fetchQuoteBatchFn?: (args: { userId: string; localIssueDate: string; candidateCount: number }) => Promise<QuoteCandidate[]>;
  selectQuoteIndexFn?: (args: {
    personalitySection: string;
    recentFeedbackSection: string;
    candidates: QuoteCandidate[];
  }) => Promise<number | null>;
};

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_QUOTE_SELECTOR_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_QUOTE_SELECTOR_RESPONSE");
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
    throw new Error("EMPTY_QUOTE_SELECTOR_RESPONSE");
  }

  return text;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function computeDeterministicOffset(seed: string, maxOffset: number): number {
  if (maxOffset <= 0) {
    return 0;
  }
  return fnv1a32(seed) % (maxOffset + 1);
}

function toNonEmptyLines(section: string): string {
  const normalized = section
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("\n- ");

  if (!normalized) {
    return "-";
  }

  return `- ${normalized}`;
}

function extractProfileSections(interestMemoryText: string): { personalitySection: string; recentFeedbackSection: string } {
  const sections = parseSections(interestMemoryText);
  if (!sections) {
    const clipped = interestMemoryText.trim().slice(0, 600);
    return {
      personalitySection: clipped || "-",
      recentFeedbackSection: clipped || "-"
    };
  }

  return {
    personalitySection: toNonEmptyLines(sections.PERSONALITY),
    recentFeedbackSection: toNonEmptyLines(sections.RECENT_FEEDBACK)
  };
}

function normalizeCandidate(candidate: QuoteCandidate): QuoteCandidate | null {
  const text = normalizeInlineText(candidate.text);
  const author = normalizeInlineText(candidate.author);
  const category = candidate.category ? normalizeInlineText(candidate.category) : null;

  if (!text || text.length < MIN_QUOTE_CHAR_COUNT || text.length > MAX_QUOTE_CHAR_COUNT) {
    return null;
  }

  if (!author) {
    return null;
  }

  return {
    rowIndex: candidate.rowIndex,
    text,
    author,
    category
  };
}

function filterQuoteCandidates(candidates: QuoteCandidate[]): QuoteCandidate[] {
  const seen = new Set<string>();
  const filtered: QuoteCandidate[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) {
      continue;
    }

    const dedupeKey = `${normalized.text.toLowerCase()}||${normalized.author.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    filtered.push(normalized);
  }

  return filtered;
}

async function fetchQuoteRows(args: { offset: number; length: number }): Promise<HfRowsFetchResult> {
  const dataset = normalizeEnvString(process.env.HF_QUOTES_DATASET) || DEFAULT_DATASET;
  const config = normalizeEnvString(process.env.HF_QUOTES_CONFIG) || DEFAULT_CONFIG;
  const split = normalizeEnvString(process.env.HF_QUOTES_SPLIT) || DEFAULT_SPLIT;
  const baseUrl = normalizeEnvString(process.env.HF_DATASET_ROWS_API_URL) || HF_DATASET_ROWS_API_URL;

  const url = new URL(baseUrl);
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("config", config);
  url.searchParams.set("split", split);
  url.searchParams.set("offset", String(args.offset));
  url.searchParams.set("length", String(args.length));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`HF_QUOTES_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const parsed = hfRowsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("HF_QUOTES_SCHEMA_INVALID");
  }

  return {
    rows: parsed.data.rows.map((row) => ({
      rowIndex: row.row_idx,
      text: row.row.quote,
      author: row.row.author,
      category: row.row.category ?? null
    })),
    totalRows: parsed.data.num_rows_total ?? DEFAULT_TOTAL_ROWS_ASSUMPTION
  };
}

async function fetchQuoteBatch(args: {
  userId: string;
  localIssueDate: string;
  candidateCount: number;
}): Promise<QuoteCandidate[]> {
  const seed = `${args.userId}:${args.localIssueDate}:quotes`;
  const totalRowsAssumption = Number.parseInt(process.env.HF_QUOTES_TOTAL_ROWS ?? "", 10);
  const assumedTotalRows =
    Number.isFinite(totalRowsAssumption) && totalRowsAssumption > 0 ? totalRowsAssumption : DEFAULT_TOTAL_ROWS_ASSUMPTION;

  const firstOffset = computeDeterministicOffset(seed, Math.max(0, assumedTotalRows - args.candidateCount));
  const first = await fetchQuoteRows({ offset: firstOffset, length: args.candidateCount });

  if (first.rows.length >= args.candidateCount) {
    return first.rows;
  }

  const correctedOffset = computeDeterministicOffset(seed, Math.max(0, first.totalRows - args.candidateCount));
  if (correctedOffset === firstOffset) {
    return first.rows;
  }

  const second = await fetchQuoteRows({ offset: correctedOffset, length: args.candidateCount });
  return second.rows;
}

function parseSelectedIndex(text: string, max: number): number | null {
  try {
    const parsedJson = parseJsonFromModelText(text);
    const parsed = quoteSelectionOutputSchema.safeParse(parsedJson);
    if (parsed.success && typeof parsed.data.selected_index === "number") {
      const value = parsed.data.selected_index;
      if (value >= 1 && value <= max) {
        return value - 1;
      }
      if (value >= 0 && value < max) {
        return value;
      }
    }
  } catch {
    // fall through to simple integer extraction
  }

  const match = text.match(/\d+/);
  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value >= 1 && value <= max) {
    return value - 1;
  }
  if (value >= 0 && value < max) {
    return value;
  }
  return null;
}

async function selectQuoteIndexWithModel(args: {
  personalitySection: string;
  recentFeedbackSection: string;
  candidates: QuoteCandidate[];
}): Promise<number | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName =
    process.env.ANTHROPIC_QUOTE_MODEL?.trim() ||
    process.env.ANTHROPIC_SUMMARY_MODEL?.trim() ||
    process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }
  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_QUOTE_OR_FALLBACK_MODEL");
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
      max_tokens: 160,
      temperature: 0,
      system: QUOTE_SELECTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildQuoteSelectionUserPrompt({
            personalitySection: args.personalitySection,
            recentFeedbackSection: args.recentFeedbackSection,
            candidates: args.candidates.map((candidate, index) => ({
              index: index + 1,
              text: candidate.text,
              author: candidate.author,
              category: candidate.category
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_QUOTE_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const text = extractTextContent(json);
  return parseSelectedIndex(text, args.candidates.length);
}

export async function selectPersonalizedQuote(
  args: SelectPersonalizedQuoteArgs,
  deps: SelectPersonalizedQuoteDeps = {}
): Promise<PersonalizedQuote> {
  const candidateCount = Math.max(5, Math.min(100, Math.floor(args.candidateCount ?? DEFAULT_CANDIDATE_COUNT)));
  const shortlistCount = Math.max(1, Math.min(candidateCount, Math.floor(args.shortlistCount ?? DEFAULT_SHORTLIST_COUNT)));

  const fetchQuoteBatchFn = deps.fetchQuoteBatchFn ?? fetchQuoteBatch;
  const selectQuoteIndexFn = deps.selectQuoteIndexFn ?? selectQuoteIndexWithModel;
  const sourceDataset = process.env.HF_QUOTES_DATASET?.trim() || DEFAULT_DATASET;

  try {
    const rawBatch = await fetchQuoteBatchFn({
      userId: args.userId,
      localIssueDate: args.localIssueDate,
      candidateCount
    });

    const filtered = filterQuoteCandidates(rawBatch);
    const shortlist = (filtered.length > 0 ? filtered : rawBatch).slice(0, shortlistCount);

    if (shortlist.length === 0) {
      return {
        text: FALLBACK_QUOTE.text,
        author: FALLBACK_QUOTE.author,
        category: FALLBACK_QUOTE.category,
        sourceDataset,
        rowIndex: null
      };
    }

    const profile = extractProfileSections(args.interestMemoryText);
    let selectedIndex = 0;

    try {
      const modelIndex = await selectQuoteIndexFn({
        personalitySection: profile.personalitySection,
        recentFeedbackSection: profile.recentFeedbackSection,
        candidates: shortlist
      });

      if (typeof modelIndex === "number" && modelIndex >= 0 && modelIndex < shortlist.length) {
        selectedIndex = modelIndex;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "QUOTE_SELECTOR_FAILED";
      logWarn("quote_selection", "model_selection_failed", {
        user_id: args.userId,
        local_issue_date: args.localIssueDate,
        error: message
      });
    }

    const selected = shortlist[selectedIndex] ?? shortlist[0];

    logInfo("quote_selection", "quote_selected", {
      user_id: args.userId,
      local_issue_date: args.localIssueDate,
      row_index: selected.rowIndex,
      source_dataset: sourceDataset
    });

    return {
      text: selected.text,
      author: selected.author,
      category: selected.category,
      sourceDataset,
      rowIndex: selected.rowIndex
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "QUOTE_SELECTION_FAILED";
    logWarn("quote_selection", "quote_selection_fallback_used", {
      user_id: args.userId,
      local_issue_date: args.localIssueDate,
      error: message
    });

    return {
      text: FALLBACK_QUOTE.text,
      author: FALLBACK_QUOTE.author,
      category: FALLBACK_QUOTE.category,
      sourceDataset,
      rowIndex: null
    };
  }
}

export const __quoteSelectionInternals = {
  computeDeterministicOffset,
  filterQuoteCandidates
};
