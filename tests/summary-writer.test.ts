import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNewsletterSummaries } from "@/lib/summary/writer";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalSummaryModel = process.env.ANTHROPIC_SUMMARY_MODEL;

const sourceItems = [
  {
    url: "https://example.com/a",
    title: "Original A",
    highlights: [
      "The article explains a new retrieval system that reduces latency in production workloads.",
      "It compares implementation tradeoffs between recall, latency, and infra cost."
    ],
    topic: "AI engineering"
  },
  {
    url: "https://example.com/b",
    title: "Original B",
    highlights: [
      "The piece covers how service boundaries affect reliability and team ownership.",
      "It includes concrete migration lessons from a staged rollout."
    ],
    topic: "software architecture"
  }
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env.ANTHROPIC_API_KEY = originalApiKey;
  process.env.ANTHROPIC_SUMMARY_MODEL = originalSummaryModel;
});

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("generateNewsletterSummaries", () => {
  it("returns final item fields only and preserves URL from source item", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Refined A",
              summary:
                "Teams replaced monolithic retrieval with staged recall and reranking to cut latency in production. The rollout compared recall against serving cost, added explicit cache invalidation controls, and used rollback thresholds tied to query failure rate and degraded relevance to keep reliability stable under load."
            })
          }
        ]
      })
    }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateNewsletterSummaries({
      items: [sourceItems[0]],
      targetWords: 50
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "Refined A",
      url: "https://example.com/a",
      summary: result[0].summary
    });
    expect(Object.keys(result[0]).sort()).toEqual(["summary", "title", "url"]);
    expect(wordCount(result[0].summary)).toBeGreaterThanOrEqual(40);
    expect(wordCount(result[0].summary)).toBeLessThanOrEqual(60);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      model: string;
      max_tokens: number;
      temperature: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.messages[0]?.content).toContain(
      "Task: produce one neutral summary grounded only in the provided highlights."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "If fewer than 2 concrete details are present, set summary to exactly: INSUFFICIENT_SOURCE_DETAIL."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "If title edit is required, change at most 8 words, preserve named entities, and do not add new claims."
    );
  });

  it("retries once and then falls back to local summary when model is invalid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "not json" }]
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateNewsletterSummaries({ items: [sourceItems[0]], targetWords: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Original A");
    expect(result[0].url).toBe("https://example.com/a");
    expect(result[0].summary).toBe("INSUFFICIENT_SOURCE_DETAIL");
  });

  it("honors custom word range when provided", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Original A",
                summary:
                  "The report details an architecture migration, the observed reliability gains, and the practical tradeoffs teams managed during phased rollout planning and execution across service boundaries." // 25 words
              })
            }
          ]
        })
      }))
    );

    const result = await generateNewsletterSummaries({
      items: [sourceItems[0]],
      minWords: 20,
      maxWords: 30
    });

    const count = wordCount(result[0].summary);
    expect(count).toBeGreaterThanOrEqual(20);
    expect(count).toBeLessThanOrEqual(30);
  });

  it("uses default 80-120 word range when no word controls are provided", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Original A",
                summary:
                  "A retrieval architecture redesign replaced monolithic ranking with staged recall, filtering, and reranking passes tuned for latency and relevance goals. The migration surfaced tradeoffs between index freshness, cache hit rates, and serving costs, and teams introduced explicit rollback thresholds, offline replay checks, and live guardrails to stabilize quality during rollout. Engineers also documented query-level failure modes, measured degradation under load tests, and used phased canary gates tied to latency percentiles and relevance drift thresholds before each broader rollout step safely."
              })
            }
          ]
        })
      }))
    );

    const result = await generateNewsletterSummaries({
      items: [sourceItems[0]]
    });

    const count = wordCount(result[0].summary);
    expect(count).toBeGreaterThanOrEqual(80);
    expect(count).toBeLessThanOrEqual(120);
  });

  it("rejects placeholder-style model summaries and falls back to deterministic highlight text", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Original A",
                summary:
                  "Unable to generate summary. The provided highlight contains only metadata."
              })
            }
          ]
        })
      }))
    );

    const result = await generateNewsletterSummaries({
      items: [sourceItems[0]],
      minWords: 20,
      maxWords: 40
    });

    expect(result[0].summary).toBe(
      "The article explains a new retrieval system that reduces latency in production workloads. It compares implementation tradeoffs between recall, latency, and infra cost."
    );
  });

  it("processes one model call per item in order", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify({ title: "A", summary: "One two three four five six seven eight nine ten." }) }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify({ title: "B", summary: "Eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty." }) }]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateNewsletterSummaries({
      items: sourceItems,
      minWords: 10,
      maxWords: 25
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe("https://example.com/a");
    expect(result[1].url).toBe("https://example.com/b");
  });

  it("trims overlong summaries at sentence boundary when possible", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Original A",
                summary:
                  "Sentence one explains the setup clearly. Sentence two goes much longer and contains many additional details that should be trimmed when enforcing maximum length limits for concise output."
              })
            }
          ]
        })
      }))
    );

    const result = await generateNewsletterSummaries({
      items: [sourceItems[0]],
      minWords: 5,
      maxWords: 10
    });

    expect(result[0].summary.endsWith(".")).toBe(true);
    expect(wordCount(result[0].summary)).toBeLessThanOrEqual(10);
  });
});
