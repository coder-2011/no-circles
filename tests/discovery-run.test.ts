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
  it("returns deterministic deduped candidates capped at target count", async () => {
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
    expect(result.candidates.map((candidate) => candidate.canonicalUrl)).toEqual([
      "https://example.com/a",
      "https://example.com/shared",
      "https://example.com/b"
    ]);
    expect(result.candidates[1].title).toBe("Shared A");
    expect(result.warnings).toEqual([]);
  });

  it("retries up to maxRetries when unique pool is insufficient", async () => {
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
    expect(result.warnings).toEqual([]);
  });

  it("keeps partial results and reports warnings when topic queries fail", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        throw new Error("rate_limited");
      }

      return [
        { url: "not-a-url", title: "bad", highlights: ["bad"] },
        { url: "https://example.com/good", title: "good", highlights: ["ok"] }
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

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].canonicalUrl).toBe("https://example.com/good");
    expect(result.warnings.some((warning) => warning.startsWith("EXA_TOPIC_FAILURE:AI engineering"))).toBe(true);
    expect(result.warnings).toContain("INSUFFICIENT_UNIQUE_CANDIDATES");
  });

  it("returns NO_ACTIVE_TOPICS warning when no valid active interests are present", async () => {
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

    const result = await runDiscovery(
      {
        interestMemoryText: emptyMemory,
        targetCount: 10
      },
      { exaSearch }
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual(["NO_ACTIVE_TOPICS"]);
    expect(exaSearch).not.toHaveBeenCalled();
  });
});
