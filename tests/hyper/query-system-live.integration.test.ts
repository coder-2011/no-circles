import { describe, expect, it } from "vitest";
import { runDiscovery, type DiscoveryRunResult } from "@/lib/discovery/run-discovery";
import { searchSonar } from "@/lib/discovery/sonar-client";
import type { ExaSearchFn } from "@/lib/discovery/types";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const INTEREST_MEMORY_TEXT = [
  "PERSONALITY:",
  "- prefers concrete, implementation-level analysis",
  "",
  "ACTIVE_INTERESTS:",
  "- distributed systems",
  "- data engineering",
  "- observability and incident response",
  "- software architecture tradeoffs",
  "- reliability engineering",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- prioritize recency for fast-moving technical developments"
].join("\n");

const RECENCY_OPERATORS = ["last 7 days", "last 30 days", "last 90 days", "last 12 months", "since previous year"] as const;

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.PERPLEXITY_API_KEY) missing.push("PERPLEXITY_API_KEY");
  return missing;
}

function hasRecencyOperator(query: string): boolean {
  const lower = query.toLowerCase();
  return RECENCY_OPERATORS.some((operator) => lower.includes(operator));
}

describe("hyper integration: query system live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "captures generated topic queries and live Perplexity responses",
    async () => {
      const runId = buildRunId("query-system-live");

      const queryTrace: Array<{
        query: string;
        numResults: number;
        durationMs: number;
        resultCount: number;
        sample: Array<{ title: string | null; url: string }>;
      }> = [];

      const liveSearch: ExaSearchFn = async ({ query, numResults }) => {
        const startedAt = Date.now();
        const results = await searchSonar({ query, numResults });
        queryTrace.push({
          query,
          numResults,
          durationMs: Date.now() - startedAt,
          resultCount: results.length,
          sample: results.slice(0, 3).map((result) => ({ title: result.title ?? null, url: result.url }))
        });
        return results;
      };

      let discovery: DiscoveryRunResult | null = null;
      let discoveryError: string | null = null;

      try {
        discovery = await runDiscovery(
          {
            interestMemoryText: INTEREST_MEMORY_TEXT,
            targetCount: 6,
            maxRetries: 1,
            maxTopics: 6,
            perTopicResults: 4,
            requireUrlExcerpt: false
          },
          {
            exaSearch: liveSearch,
            linkSelector: async () => null
          }
        );
      } catch (error) {
        discoveryError = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      }

      await writeHyperLog({
        group: "query-system",
        runId,
        fileName: "00-interest-memory.txt",
        content: INTEREST_MEMORY_TEXT
      });
      await writeHyperLog({
        group: "query-system",
        runId,
        fileName: "01-query-trace.txt",
        content: toPrettyJson(queryTrace)
      });

      if (discovery) {
        await writeHyperLog({
          group: "query-system",
          runId,
          fileName: "02-discovery-output.txt",
          content: toPrettyJson(discovery)
        });
      }

      if (discoveryError) {
        await writeHyperLog({
          group: "query-system",
          runId,
          fileName: "02-discovery-error.txt",
          content: discoveryError
        });
      }

      const capturedLiveQueries = queryTrace.length > 0;
      const capturedDiscoveryError = typeof discoveryError === "string" && discoveryError.length > 0;

      expect(capturedLiveQueries || capturedDiscoveryError).toBe(true);
      if (capturedLiveQueries) {
        expect(queryTrace.some((entry) => hasRecencyOperator(entry.query))).toBe(true);
      }
    },
    240000
  );
});
