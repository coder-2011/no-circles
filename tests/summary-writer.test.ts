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
                "This article explains a lower-latency retrieval approach, compares implementation tradeoffs, and shows how teams balanced recall quality against serving cost in production." // 23 words
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
    expect(requestBody.messages[0]?.content).toContain("Title policy: preserve the original title wording as much as possible.");
    expect(requestBody.messages[0]?.content).toContain(
      "Only edit the title when the original is unclear, vague, or fails to communicate the main idea."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "Do not end titles with trailing generic format labels (for example: article, postmortem, post, thread, report) unless required for meaning."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "Use clear, direct language and prefer simpler words when accuracy is unchanged."
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
    expect(wordCount(result[0].summary)).toBeGreaterThanOrEqual(40);
    expect(wordCount(result[0].summary)).toBeLessThanOrEqual(60);
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
