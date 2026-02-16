import { describe, expect, it, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/run-discovery";

const memory = [
  "PERSONALITY:",
  "- prefers practical explainers",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- distributed systems",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- more practical examples"
].join("\n");

describe("runDiscovery", () => {
  it("fills to target count after selecting one winner per topic", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        return [
          {
            url: "https://example.com/a?utm_source=newsletter",
            title: "A",
            highlights: ["summary a"],
            score: 0.8
          },
          {
            url: "https://example.com/shared#section",
            title: "Shared A",
            highlights: ["shared"],
            score: 0.9
          }
        ];
      }

      return [
        {
          url: "https://example.com/shared",
          title: "Shared B",
          highlights: ["shared b"],
          score: 0.5
        },
        {
          url: "https://example.com/b",
          title: "B",
          highlights: ["summary b"],
          score: 0.7
        }
      ];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 3,
        maxRetries: 1,
        perTopicResults: 2,
        maxTopics: 2
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(3);
    expect(new Set(result.candidates.map((candidate) => candidate.topic)).size).toBe(2);
    expect(result.candidates.map((candidate) => candidate.canonicalUrl)).toEqual([
      "https://example.com/shared",
      "https://example.com/b",
      "https://example.com/a"
    ]);
    expect(result.warnings).toContain("BACKFILLED_FROM_QUALITY_POOL_1");
  });

  it("retries up to maxRetries and backfills to target when topic winner pool is insufficient", async () => {
    const exaSearch = vi
      .fn()
      .mockResolvedValueOnce([
        { url: "https://example.com/only", title: "only", highlights: ["x"] },
        { url: "https://example.com/only#dup", title: "only dup", highlights: ["x"] }
      ])
      .mockResolvedValueOnce([{ url: "https://example.com/only", title: "only", highlights: ["x"] }])
      .mockResolvedValueOnce([
        { url: "https://example.com/only", title: "only", highlights: ["x"] },
        { url: "https://example.com/new-1", title: "new 1", highlights: ["y"] },
        { url: "https://example.com/new-2", title: "new 2", highlights: ["z"] }
      ])
      .mockResolvedValueOnce([{ url: "https://example.com/new-3", title: "new 3", highlights: ["w"] }]);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 4,
        maxRetries: 2,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.attempts).toBe(2);
    expect(result.candidates).toHaveLength(4);
    expect(exaSearch).toHaveBeenCalledTimes(4);
    expect(exaSearch.mock.calls[0][0]).toMatchObject({ numResults: 2 });
    expect(exaSearch.mock.calls[2][0]).toMatchObject({ numResults: 4 });
    expect(result.warnings.some((warning) => warning.startsWith("BACKFILLED_FROM_QUALITY_POOL_"))).toBe(true);
  });

  it("evaluates early-stop policy without breaking one-per-topic selection", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      const suffix = query.startsWith("AI engineering") ? "ai" : "dist";
      return [
        { url: `https://d1.com/${suffix}-a`, title: "a", highlights: ["x"], score: 0.95 },
        { url: `https://d2.com/${suffix}-b`, title: "b", highlights: ["x"], score: 0.92 },
        { url: `https://d3.com/${suffix}-c`, title: "c", highlights: ["x"], score: 0.91 },
        { url: `https://d4.com/${suffix}-d`, title: "d", highlights: ["x"], score: 0.9 },
        { url: `https://d5.com/${suffix}-e`, title: "e", highlights: ["x"], score: 0.89 },
        { url: `https://d6.com/${suffix}-f`, title: "f", highlights: ["x"], score: 0.88 }
      ];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 2,
        maxRetries: 3,
        maxTopics: 2,
        perTopicResults: 6,
        earlyStopBuffer: 0,
        maxPerDomain: 2
      },
      { exaSearch }
    );

    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(exaSearch.mock.calls.length).toBeGreaterThan(1);
  });

  it("uses suppressed-topic fallback only when required to hit target count", async () => {
    const suppressedMemory = [
      "PERSONALITY:",
      "- curious",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "- crypto",
      "",
      "SUPPRESSED_INTERESTS:",
      "- crypto",
      "",
      "RECENT_FEEDBACK:",
      "- avoid crypto"
    ].join("\n");

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI")) {
        return [{ url: "https://ai.com/a", title: "AI", highlights: ["ok"], score: 0.8 }];
      }

      return [
        { url: "https://crypto.com/1", title: "C1", highlights: ["c"], score: 0.99 },
        { url: "https://crypto.com/2", title: "C2", highlights: ["c"], score: 0.99 }
      ];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: suppressedMemory,
        targetCount: 2,
        maxRetries: 1,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.candidates.map((candidate) => candidate.topic)).toEqual(["AI", "crypto"]);
    expect(result.warnings).toContain("RELAXED_SUPPRESSION_BACKFILL_1");
    expect(result.warnings).toContain("NON_SUPPRESSED_POOL_BELOW_TARGET");
  });

  it("backfills with same-topic candidates when strict one-per-topic is insufficient", async () => {
    const exaSearch = vi.fn(async () => [
      { url: "https://same.com/a", title: "A", highlights: ["x"], score: 0.8 },
      { url: "https://same.com/b", title: "B", highlights: ["x"], score: 0.79 },
      { url: "https://same.com/c", title: "C", highlights: ["x"], score: 0.78 }
    ]);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 3,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 3,
        maxPerDomain: 1
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://same.com/a");
    expect(result.warnings).toContain("BACKFILLED_FROM_QUALITY_POOL_2");
  });

  it("keeps partial results and reports warnings when topic queries fail", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        throw new Error("rate_limited");
      }

      return [
        { url: "not-a-url", title: "bad", highlights: ["bad"] },
        { url: "https://example.com/good", title: "good", highlights: ["ok"] },
        { url: "https://example.com/good-2", title: "good 2", highlights: ["ok 2"] }
      ];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 2,
        maxRetries: 1,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].canonicalUrl).toBe("https://example.com/good");
    expect(result.candidates[1].canonicalUrl).toBe("https://example.com/good-2");
    expect(result.warnings.some((warning) => warning.startsWith("EXA_TOPIC_FAILURE:AI engineering"))).toBe(true);
    expect(result.warnings).toContain("BACKFILLED_FROM_QUALITY_POOL_1");
  });

  it("throws when no valid active interests are present", async () => {
    const emptyMemory = [
      "PERSONALITY:",
      "- curious",
      "",
      "ACTIVE_INTERESTS:",
      "-",
      "",
      "SUPPRESSED_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const exaSearch = vi.fn();

    await expect(
      runDiscovery(
        {
          interestMemoryText: emptyMemory,
          targetCount: 10
        },
        { exaSearch }
      )
    ).rejects.toThrow("NO_ACTIVE_TOPICS");
    expect(exaSearch).not.toHaveBeenCalled();
  });

  it("filters known low-signal domains before selecting topic winners", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        return [
          { url: "https://itbooks.ir/assets/files/books/x.pdf", title: "book mirror", highlights: ["x"], score: 0.9 },
          { url: "https://example.com/ai-good", title: "good ai", highlights: ["x"], score: 0.81 }
        ];
      }

      return [{ url: "https://example.com/dist-good", title: "good dist", highlights: ["y"], score: 0.79 }];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 2,
        maxRetries: 1,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.sourceDomain !== "itbooks.ir")).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("LOW_SIGNAL_FILTERED_"))).toBe(true);
  });
});
