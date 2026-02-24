import { afterEach, describe, expect, it, vi } from "vitest";
import { __quoteSelectionInternals, selectPersonalizedQuote } from "@/lib/quotes/select-personalized-quote";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalQuoteModel = process.env.ANTHROPIC_QUOTE_MODEL;
const originalSummaryModel = process.env.ANTHROPIC_SUMMARY_MODEL;
const originalMemoryModel = process.env.ANTHROPIC_MEMORY_MODEL;
const originalDataset = process.env.HF_QUOTES_DATASET;
const originalConfig = process.env.HF_QUOTES_CONFIG;
const originalSplit = process.env.HF_QUOTES_SPLIT;
const originalRowsUrl = process.env.HF_DATASET_ROWS_API_URL;
const originalTotalRows = process.env.HF_QUOTES_TOTAL_ROWS;

function restoreEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function makeRowsResponse() {
  return {
    rows: [
      {
        row_idx: 11,
        row: {
          quote: "A first concrete quote about working from evidence and updating beliefs when reality changes.",
          author: "Author One",
          category: "evidence, learning"
        }
      },
      {
        row_idx: 12,
        row: {
          quote: "A second quote about disciplined iteration, clear assumptions, and measurable outcomes over vague claims.",
          author: "Author Two",
          category: "iteration, rigor"
        }
      },
      {
        row_idx: 13,
        row: {
          quote: "Short",
          author: "Ignored Author",
          category: "ignore"
        }
      },
      {
        row_idx: 14,
        row: {
          quote: "A fourth candidate quote with enough concrete language to survive the lightweight prefilter stage safely.",
          author: "Author Four",
          category: "quality"
        }
      },
      {
        row_idx: 15,
        row: {
          quote: "A fifth candidate quote focused on rigorous iteration and practical evaluation constraints in real systems.",
          author: "Author Five",
          category: "systems"
        }
      }
    ],
    num_rows_total: 499709
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  restoreEnvVar("ANTHROPIC_API_KEY", originalApiKey);
  restoreEnvVar("ANTHROPIC_QUOTE_MODEL", originalQuoteModel);
  restoreEnvVar("ANTHROPIC_SUMMARY_MODEL", originalSummaryModel);
  restoreEnvVar("ANTHROPIC_MEMORY_MODEL", originalMemoryModel);
  restoreEnvVar("HF_QUOTES_DATASET", originalDataset);
  restoreEnvVar("HF_QUOTES_CONFIG", originalConfig);
  restoreEnvVar("HF_QUOTES_SPLIT", originalSplit);
  restoreEnvVar("HF_DATASET_ROWS_API_URL", originalRowsUrl);
  restoreEnvVar("HF_QUOTES_TOTAL_ROWS", originalTotalRows);
});

describe("selectPersonalizedQuote", () => {
  it("uses deterministic batch sampling and returns model-selected quote", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_QUOTE_MODEL = "claude-haiku-4-5";
    process.env.HF_QUOTES_TOTAL_ROWS = "500000";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeRowsResponse()
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: '{"selected_index": 2}' }]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await selectPersonalizedQuote({
      userId: "user-1",
      localIssueDate: "2026-02-24",
      interestMemoryText: [
        "PERSONALITY:",
        "- practical",
        "",
        "ACTIVE_INTERESTS:",
        "- systems",
        "",
        "SUPPRESSED_INTERESTS:",
        "-",
        "",
        "RECENT_FEEDBACK:",
        "- less hype, more concrete tradeoffs"
      ].join("\n"),
      candidateCount: 5,
      shortlistCount: 2
    });

    expect(result.text).toContain("A second quote");
    expect(result.author).toBe("Author Two");
    expect(result.rowIndex).toBe(12);

    const rowsUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const expectedOffset = __quoteSelectionInternals.computeDeterministicOffset("user-1:2026-02-24:quotes", 500000 - 5);
    expect(rowsUrl.searchParams.get("dataset")).toBe("jstet/quotes-500k");
    expect(rowsUrl.searchParams.get("config")).toBe("default");
    expect(rowsUrl.searchParams.get("split")).toBe("train");
    expect(rowsUrl.searchParams.get("length")).toBe("5");
    expect(rowsUrl.searchParams.get("offset")).toBe(String(expectedOffset));

    const requestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.system).toContain("personalized quote curator");
    expect(requestBody.messages[0]?.content).toContain("Reader profile (PERSONALITY):");
    expect(requestBody.messages[0]?.content).toContain("Most recent steering (RECENT_FEEDBACK):");
  });

  it("falls back to first filtered candidate when model call is unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_QUOTE_MODEL;
    delete process.env.ANTHROPIC_SUMMARY_MODEL;
    delete process.env.ANTHROPIC_MEMORY_MODEL;

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeRowsResponse()
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await selectPersonalizedQuote({
      userId: "user-2",
      localIssueDate: "2026-02-24",
      interestMemoryText: "PERSONALITY:\n-\n\nACTIVE_INTERESTS:\n-\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-",
      candidateCount: 5,
      shortlistCount: 2
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.text).toContain("A first concrete quote");
    expect(result.author).toBe("Author One");
    expect(result.rowIndex).toBe(11);
  });
});
