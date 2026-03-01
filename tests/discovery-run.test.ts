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
  "RECENT_FEEDBACK:",
  "- more practical examples"
].join("\n");

describe("runDiscovery", () => {
  it("requires URL excerpts when enabled and drops candidates that fail extraction", async () => {
    const exaSearch = vi.fn(async () => [
      { url: "https://example.com/kept", title: "Kept", highlights: ["legacy"], score: 0.9 },
      { url: "https://example.com/dropped", title: "Dropped", highlights: ["legacy"], score: 0.85 }
    ]);
    const excerptExtractor = vi.fn(async ({ url }: { url: string }) => {
      if (url.includes("dropped")) return null;
      return "Extracted body text for ranking and selection.";
    });
    const linkSelector = vi.fn(async () => 0);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        perTopicResults: 2,
        maxTopics: 1,
        requireUrlExcerpt: true
      },
      { exaSearch, excerptExtractor, linkSelector }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/kept");
    expect(linkSelector).not.toHaveBeenCalled();
    expect(result.warnings.some((warning) => warning.startsWith("CANDIDATE_EXTRACTION_FAILED:"))).toBe(true);
  });

  it("excludes includeCandidate-rejected URLs before Haiku selector input", async () => {
    const exaSearch = vi.fn(async () => [
      { url: "https://example.com/repeated", title: "Repeated", highlights: ["legacy"], score: 0.9 },
      { url: "https://example.com/fresh", title: "Fresh", highlights: ["fresh"], score: 0.85 }
    ]);

    const linkSelector = vi.fn(async () => 0);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        perTopicResults: 2,
        maxTopics: 1
      },
      {
        exaSearch,
        includeCandidate: (candidate) => candidate.canonicalUrl !== "https://example.com/repeated",
        linkSelector
      }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/fresh");
    expect(linkSelector).not.toHaveBeenCalled();
    expect(result.warnings).toContain("CANDIDATE_FILTERED_1");
  });

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
      "https://example.com/a",
      "https://example.com/shared",
      "https://example.com/b"
    ]);
  });

  it("uses Haiku query builder output and falls back deterministically when it fails", async () => {
    const builtQueries: string[] = [];
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      builtQueries.push(query);
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return [{ url: `https://example.com/${slug}`, title: "One", highlights: ["signal"], score: 0.9 }];
    });

    const queryBuilder = vi
      .fn()
      .mockResolvedValueOnce("niche distributed systems retry storm mitigation patterns")
      .mockRejectedValueOnce(new Error("QUERY_TOO_LONG"));

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 2,
        maxRetries: 1,
        perTopicResults: 1,
        maxTopics: 2
      },
      { exaSearch, queryBuilder }
    );

    expect(result.candidates).toHaveLength(2);
    expect(queryBuilder).toHaveBeenCalledTimes(2);
    expect(builtQueries[0]).toContain("niche distributed systems retry storm mitigation patterns");
    expect(builtQueries[1]).toMatch(/AI engineering|distributed systems/);
    expect(result.warnings.some((warning) => warning.startsWith("QUERY_BUILDER_FALLBACK:"))).toBe(true);
  });

  it("retries only topics with zero viable candidates", async () => {
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

    await expect(
      runDiscovery(
        {
          interestMemoryText: memory,
          targetCount: 4,
          maxRetries: 2,
          maxTopics: 2,
          perTopicResults: 2
        },
        { exaSearch }
      )
    ).rejects.toThrow("INSUFFICIENT_QUALITY_CANDIDATES");

    // Only the first-attempt topic calls execute because both topics produce viable candidates.
    expect(exaSearch).toHaveBeenCalledTimes(2);
    expect(exaSearch.mock.calls[0][0]).toMatchObject({ numResults: 2 });
    expect(exaSearch.mock.calls[1][0]).toMatchObject({ numResults: 2 });
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

  it("does not fall back to personality or feedback topics when active interests already exist", async () => {
    const narrowMemory = [
      "PERSONALITY:",
      "- crypto market structure",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "",
      "RECENT_FEEDBACK:",
      "- more crypto market structure"
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

    await expect(
      runDiscovery(
        {
          interestMemoryText: narrowMemory,
          targetCount: 2,
          maxRetries: 1,
          maxTopics: 2,
          perTopicResults: 2
        },
        { exaSearch }
      )
    ).rejects.toThrow("INSUFFICIENT_QUALITY_CANDIDATES");

    expect(exaSearch).toHaveBeenCalledTimes(1);
    expect(String(exaSearch.mock.calls[0]?.[0]?.query ?? "")).toContain("AI");
  });

  it("derives topics from legacy memory shape without treating legacy suppressed entries as active topics", async () => {
    const suppressedMemory = [
      "PERSONALITY:",
      "- crypto market structure",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "",
      "SUPPRESSED_INTERESTS:",
      "- crypto",
      "",
      "RECENT_FEEDBACK:",
      "- more crypto market structure"
    ].join("\n");

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI")) {
        return [{ url: "https://ai.com/a", title: "AI", highlights: ["ok"], score: 0.8 }];
      }

      return [{ url: "https://crypto.com/1", title: "C1", highlights: ["c"], score: 0.99 }];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: suppressedMemory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates.map((candidate) => candidate.topic)).toEqual(["AI"]);
    expect(exaSearch).toHaveBeenCalledTimes(1);
    expect(String(exaSearch.mock.calls[0]?.[0]?.query ?? "")).toContain("AI");
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
    expect(result.candidates.map((candidate) => candidate.canonicalUrl)).toEqual([
      "https://same.com/a",
      "https://same.com/b",
      "https://same.com/c"
    ]);
  });

  it("prefers underrepresented topics during backfill before repeating a dominant topic", async () => {
    const breadthMemory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- topic a",
      "- topic b",
      "- topic c",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("topic a")) {
        return [
          { url: "https://a.com/one", title: "a1", highlights: ["x"], score: 0.9 },
          { url: "https://a.com/two", title: "a2", highlights: ["x"], score: 0.86 },
          { url: "https://a.com/three", title: "a3", highlights: ["x"], score: 0.84 }
        ];
      }
      if (query.startsWith("topic b")) {
        return [{ url: "https://b.com/one", title: "b1", highlights: ["x"], score: 0.83 }];
      }
      return [{ url: "https://c.com/one", title: "c1", highlights: ["x"], score: 0.82 }];
    });

    const result = await runDiscovery(
      {
        interestMemoryText: breadthMemory,
        targetCount: 4,
        maxRetries: 1,
        maxTopics: 3,
        perTopicResults: 3,
        maxPerDomain: 4
      },
      { exaSearch }
    );

    const countsByTopic = result.candidates.reduce<Record<string, number>>((acc, candidate) => {
      acc[candidate.topic] = (acc[candidate.topic] ?? 0) + 1;
      return acc;
    }, {});

    expect(result.candidates).toHaveLength(4);
    expect(countsByTopic["topic a"]).toBe(2);
    expect(countsByTopic["topic b"]).toBe(1);
    expect(countsByTopic["topic c"]).toBe(1);
  });

  it("keeps partial results and backfills from quality pool when topic queries fail", async () => {
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
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/good");
    expect(result.candidates[1]?.canonicalUrl).toBe("https://example.com/good-2");
    expect(result.warnings.some((warning) => warning.startsWith("EXA_TOPIC_FAILURE:AI engineering"))).toBe(true);
    expect(result.warnings).toContain("BACKFILLED_FROM_QUALITY_POOL_1");
  });

  it("derives topic seeds from personality/feedback when active interests are missing", async () => {
    const noActiveMemory = [
      "PERSONALITY:",
      "- distributed systems design",
      "",
      "ACTIVE_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const exaSearch = vi.fn(async () => [
      { url: "https://example.com/seed", title: "seed", highlights: ["seed highlight"], score: 0.9 }
    ]);

    const result = await runDiscovery(
      {
        interestMemoryText: noActiveMemory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 3,
        perTopicResults: 1
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.topics.length).toBeGreaterThanOrEqual(1);
    expect(exaSearch).toHaveBeenCalled();
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

  it("filters wikipedia and youtube candidates as low-signal sources", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        return [
          { url: "https://en.wikipedia.org/wiki/Retrieval-augmented_generation", title: "wiki rag", highlights: ["x"], score: 0.9 },
          { url: "https://example.com/ai-good", title: "good ai", highlights: ["x"], score: 0.82 }
        ];
      }

      return [
        { url: "https://www.youtube.com/watch?v=abc123", title: "video", highlights: ["y"], score: 0.88 },
        { url: "https://example.com/dist-good", title: "good dist", highlights: ["y"], score: 0.81 }
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
    expect(result.candidates.every((candidate) => candidate.sourceDomain !== "wikipedia.org")).toBe(true);
    expect(result.candidates.every((candidate) => candidate.sourceDomain !== "youtube.com")).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("LOW_SIGNAL_FILTERED_"))).toBe(true);
  });

  it("filters index/hub-style pages before selecting winners", async () => {
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        return [
          { url: "https://example.org/resources", title: "resources index", highlights: ["x"], score: 0.85 },
          { url: "https://example.org/ai/practical-implementation", title: "ai practical", highlights: ["x"], score: 0.84 }
        ];
      }

      return [{ url: "https://dist.dev/ops/rollout-patterns", title: "dist practical", highlights: ["y"], score: 0.83 }];
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
    expect(result.candidates.every((candidate) => !candidate.canonicalUrl.endsWith("/resources"))).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("LOW_SIGNAL_FILTERED_"))).toBe(true);
  });

  it("drops extracted candidates when excerpt content is navigation-heavy or not-found text", async () => {
    const exaSearch = vi.fn(async () => [
      { url: "https://example.com/not-found", title: "missing", highlights: ["x"], score: 0.9 },
      { url: "https://example.com/good", title: "good", highlights: ["x"], score: 0.88 }
    ]);
    const excerptExtractor = vi.fn(async ({ url }: { url: string }) => {
      if (url.includes("not-found")) {
        return "Post not found. Sign in. Sign up. Privacy policy. Terms. Contact us. Menu.";
      }
      return "A concrete incident write-up explains rollback sequencing, error budgets, and failure-domain isolation in production.";
    });

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 2,
        requireUrlExcerpt: true
      },
      { exaSearch, excerptExtractor }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/good");
    expect(result.warnings.some((warning) => warning.startsWith("CANDIDATE_LOW_SIGNAL_EXCERPT:"))).toBe(true);
  });

  it("uses top-2 mean highlight score when Exa score is unavailable", async () => {
    const highlightScoreMemory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- ranking",
      "",
      "RECENT_FEEDBACK:",
      "- use evidence"
    ].join("\n");

    const exaSearch = vi.fn(async () => [
      {
        url: "https://example.com/high-a",
        title: "A",
        highlights: ["h1", "h2", "h3"],
        highlightScores: [0.4, 0.95, 0.9]
      },
      {
        url: "https://example.com/high-b",
        title: "B",
        highlights: ["x1", "x2"],
        highlightScores: [0.8, 0.81]
      }
    ]);

    const result = await runDiscovery(
      {
        interestMemoryText: highlightScoreMemory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 2
      },
      { exaSearch }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/high-a");
    expect(result.candidates[0]?.highlights).toEqual(["h1", "h2", "h3"]);
    expect(result.candidates[0]?.highlightScores).toEqual([0.4, 0.95, 0.9]);
  });

  it("supports candidate include filter for downstream anti-repeat gating", async () => {
    const memory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- distributed systems",
      "",
      "RECENT_FEEDBACK:",
      "- less hype"
    ].join("\n");

    const blockedCanonical = "https://example.com/blocked";
    const exaSearch = vi.fn(async () => [
      { url: blockedCanonical, title: "blocked", highlights: ["x"], score: 0.95 },
      { url: "https://example.com/allowed", title: "allowed", highlights: ["y"], score: 0.9 }
    ]);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 2
      },
      {
        exaSearch,
        includeCandidate: (candidate) => candidate.canonicalUrl !== blockedCanonical
      }
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/allowed");
    expect(result.warnings).toContain("CANDIDATE_FILTERED_1");
  });

  it("uses per-topic link selector and appends rotated recency operator", async () => {
    const exaSearch = vi.fn(async () => [{ url: "https://example.com/one", title: "one", highlights: ["x"], score: 0.9 }]);
    const linkSelector = vi.fn(async () => 0);

    await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 1
      },
      { exaSearch, linkSelector }
    );

    expect(linkSelector).not.toHaveBeenCalled();
    expect(exaSearch).toHaveBeenCalledTimes(1);
    expect(
      ["AI engineering", "distributed systems"].some((topic) =>
        String(exaSearch.mock.calls[0]?.[0]?.query ?? "").includes(topic)
      )
    ).toBe(true);
    expect(
      ["last 7 days", "last 30 days", "last 90 days", "last 12 months", "since previous year"].some((operator) =>
        String(exaSearch.mock.calls[0]?.[0]?.query ?? "").includes(operator)
      )
    ).toBe(true);
  });

  it("reorders topic results when selector returns a non-zero index", async () => {
    const exaSearch = vi.fn(async () => [
      { url: "https://example.com/first", title: "first", highlights: ["x"], score: 0.7 },
      { url: "https://example.com/second", title: "second", highlights: ["x"], score: 0.7 }
    ]);
    const linkSelector = vi.fn(async () => 1);

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 1,
        maxRetries: 1,
        maxTopics: 1,
        perTopicResults: 2
      },
      { exaSearch, linkSelector }
    );

    expect(linkSelector).toHaveBeenCalledTimes(1);
    expect(result.candidates[0]?.canonicalUrl).toBe("https://example.com/second");
  });

  it("passes progressive already-selected topic/title context into selector calls", async () => {
    const memoryTwoTopics = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering",
      "- distributed systems",
      "",
      "RECENT_FEEDBACK:",
      "- less hype"
    ].join("\n");

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      if (query.startsWith("AI engineering")) {
        return [
          { url: "https://example.com/ai-1", title: "AI Title 1", highlights: ["x"], score: 0.9 },
          { url: "https://example.com/ai-2", title: "AI Title 2", highlights: ["x"], score: 0.85 }
        ];
      }

      return [
        { url: "https://example.com/dist-1", title: "Dist Title 1", highlights: ["x"], score: 0.9 },
        { url: "https://example.com/dist-2", title: "Dist Title 2", highlights: ["x"], score: 0.85 }
      ];
    });
    const linkSelector = vi.fn(async () => 0);

    await runDiscovery(
      {
        interestMemoryText: memoryTwoTopics,
        targetCount: 2,
        maxRetries: 1,
        maxTopics: 2,
        perTopicResults: 2
      },
      { exaSearch, linkSelector }
    );

    expect(linkSelector).toHaveBeenCalledTimes(2);
    const firstCallArgs = linkSelector.mock.calls[0]?.[0] as { alreadySelected: Array<{ topic: string; title: string }> };
    const secondCallArgs = linkSelector.mock.calls[1]?.[0] as { alreadySelected: Array<{ topic: string; title: string }> };

    expect(firstCallArgs.alreadySelected).toEqual([]);
    expect(secondCallArgs.alreadySelected).toEqual([{ topic: "AI engineering", title: "AI Title 1" }]);
  });

  it("builds full cumulative selector context across ten topics", async () => {
    const topics = [
      "topic 1",
      "topic 2",
      "topic 3",
      "topic 4",
      "topic 5",
      "topic 6",
      "topic 7",
      "topic 8",
      "topic 9",
      "topic 10"
    ];

    const memoryTenTopics = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      ...topics.map((topic) => `- ${topic}`),
      "",
      "RECENT_FEEDBACK:",
      "- less hype"
    ].join("\n");

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      const matchedTopic = [...topics].sort((a, b) => b.length - a.length).find((topic) => query.startsWith(topic));
      if (!matchedTopic) {
        throw new Error(`unexpected_topic_query:${query}`);
      }

      return [
        {
          url: `https://example.com/${matchedTopic.replace(/\s+/g, "-")}/primary`,
          title: `${matchedTopic} primary`,
          highlights: ["x"],
          score: 0.9
        },
        {
          url: `https://example.com/${matchedTopic.replace(/\s+/g, "-")}/secondary`,
          title: `${matchedTopic} secondary`,
          highlights: ["x"],
          score: 0.85
        }
      ];
    });

    const linkSelector = vi.fn(async () => 0);

    const result = await runDiscovery(
      {
        interestMemoryText: memoryTenTopics,
        targetCount: 10,
        maxRetries: 1,
        maxTopics: 10,
        perTopicResults: 2
      },
      { exaSearch, linkSelector }
    );

    expect(result.candidates).toHaveLength(10);
    expect(linkSelector).toHaveBeenCalledTimes(10);

    for (let callIndex = 0; callIndex < 10; callIndex += 1) {
      const callArgs = linkSelector.mock.calls[callIndex]?.[0] as {
        topic: string;
        alreadySelected: Array<{ topic: string; title: string }>;
      };
      const expectedAlreadySelected = topics.slice(0, callIndex).map((topic) => ({
        topic,
        title: `${topic} primary`
      }));

      expect(callArgs.topic).toBe(topics[callIndex]);
      expect(callArgs.alreadySelected).toEqual(expectedAlreadySelected);
    }
  });
});
