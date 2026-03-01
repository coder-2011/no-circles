import { describe, expect, it } from "vitest";
import { selectSerendipityTopics } from "@/lib/discovery/haiku-serendipity-selector";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import type { ExaSearchFn } from "@/lib/discovery/types";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const INTEREST_MEMORY_TEXT = [
  "PERSONALITY:",
  "- prefers evidence-first, implementation-level analysis with minimal fluff",
  "",
  "ACTIVE_INTERESTS:",
  "- distributed systems",
  "- data engineering",
  "- observability and incident response",
  "- software architecture tradeoffs",
  "- reliability engineering",
  "",
  "RECENT_FEEDBACK:",
  "- add some adjacent topics when they create real learning value",
  "- less hype, more institutional and technical substance"
].join("\n");

const ACTIVE_TOPICS = [
  "distributed systems",
  "data engineering",
  "observability and incident response",
  "software architecture tradeoffs",
  "reliability engineering"
];

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    missing.push("OPENROUTER_API_KEY|ANTHROPIC_API_KEY");
  }
  if (
    !process.env.OPENROUTER_SERENDIPITY_MODEL &&
    !process.env.OPENROUTER_LINK_SELECTOR_MODEL &&
    !process.env.OPENROUTER_SUMMARY_MODEL &&
    !process.env.OPENROUTER_MEMORY_MODEL &&
    !process.env.ANTHROPIC_SERENDIPITY_MODEL &&
    !process.env.ANTHROPIC_LINK_SELECTOR_MODEL &&
    !process.env.ANTHROPIC_SUMMARY_MODEL &&
    !process.env.ANTHROPIC_MEMORY_MODEL
  ) {
    missing.push("OPENROUTER_*_MODEL|ANTHROPIC_*_MODEL");
  }
  return missing;
}

describe("hyper integration: serendipity live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "selects adjacent serendipity topics live and surfaces them through discovery",
    async () => {
      const runId = buildRunId("serendipity-live");

      const selectedTopics = await selectSerendipityTopics({
        activeTopics: ACTIVE_TOPICS,
        interestMemoryText: INTEREST_MEMORY_TEXT,
        maxTopics: 2
      });

      const queryTrace: Array<{
        query: string;
        numResults: number;
        resultCount: number;
      }> = [];

      const deterministicSearch: ExaSearchFn = async ({ query, numResults }) => {
        const slugBase = query
          .toLowerCase()
          .replace(/\b(last 7 days|last 30 days|last 90 days|last 12 months|since previous year)\b/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48);

        const results = Array.from({ length: Math.max(numResults, 3) }).map((_, index) => ({
          url: `https://example.com/${slugBase}/${index + 1}`,
          title: `${query} result ${index + 1}`,
          highlights: [
            `Concrete analysis for ${query} with implementation details, operational tradeoffs, and adjacent learning value.`
          ],
          score: 0.92 - index * 0.03
        }));

        queryTrace.push({
          query,
          numResults,
          resultCount: results.length
        });
        return results;
      };

      const discovery = await runDiscovery(
        {
          interestMemoryText: INTEREST_MEMORY_TEXT,
          targetCount: 10,
          maxRetries: 1,
          maxTopics: 7,
          perTopicResults: 4,
          requireUrlExcerpt: false
        },
        {
          exaSearch: deterministicSearch,
          linkSelector: async () => null
        }
      );

      await writeHyperLog({
        group: "serendipity",
        runId,
        fileName: "00-interest-memory.txt",
        content: INTEREST_MEMORY_TEXT
      });
      await writeHyperLog({
        group: "serendipity",
        runId,
        fileName: "01-selector-output.txt",
        content: toPrettyJson({ activeTopics: ACTIVE_TOPICS, selectedTopics })
      });
      await writeHyperLog({
        group: "serendipity",
        runId,
        fileName: "02-query-trace.txt",
        content: toPrettyJson(queryTrace)
      });
      await writeHyperLog({
        group: "serendipity",
        runId,
        fileName: "03-discovery-output.txt",
        content: toPrettyJson(discovery)
      });

      const activeSet = new Set(ACTIVE_TOPICS.map((topic) => topic.toLowerCase()));
      const discoverySerendipityTopics = discovery.serendipityTopics ?? [];

      expect(selectedTopics.length).toBeGreaterThanOrEqual(1);
      expect(selectedTopics.length).toBeLessThanOrEqual(2);
      expect(new Set(selectedTopics.map((topic) => topic.toLowerCase())).size).toBe(selectedTopics.length);
      expect(selectedTopics.every((topic) => !activeSet.has(topic.toLowerCase()))).toBe(true);

      expect(discoverySerendipityTopics.length).toBeGreaterThanOrEqual(1);
      expect(discoverySerendipityTopics.length).toBeLessThanOrEqual(2);
      expect(discoverySerendipityTopics.every((topic) => !activeSet.has(topic.toLowerCase()))).toBe(true);

      const discoveredTopicSet = new Set(discovery.topics.map((topic) => topic.topic));
      expect(discoverySerendipityTopics.every((topic) => discoveredTopicSet.has(topic))).toBe(true);
      expect(queryTrace.length).toBeGreaterThanOrEqual(discovery.topics.length);
    },
    240000
  );
});
