import { describe, expect, it } from "vitest";
import { runDiscovery } from "@/lib/discovery/run-discovery";

const memory = [
  "PERSONALITY:",
  "- prefers practical, implementation-focused analysis",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- distributed systems",
  "- philosophy of science",
  "- macroeconomics",
  "- product strategy",
  "- software architecture",
  "- behavioral economics",
  "- data engineering",
  "- science policy",
  "- startup strategy",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- less hype, more concrete tradeoffs"
].join("\n");

const MIN_CANDIDATE_COUNT = 6;
const MIN_DISTINCT_DOMAINS = 5;
const MIN_DISTINCT_TOPICS = 6;
const MIN_HIGHLIGHT_COVERAGE = 0.9;
const MAX_LOW_SIGNAL_RATIO = 0.25;
const LIVE_TEST_FLAG = process.env.RUN_LIVE_TAVILY_TESTS === "1";
const HAS_DISCOVERY_KEY = Boolean(process.env.TAVILY_API_KEY);

const KNOWN_LOW_SIGNAL_DOMAINS = new Set([
  "goodreads.com",
  "studylib.net",
  "itbooks.ir",
  "barnesandnoble.com",
  "books.google.com",
  "bookshop.org",
  "scribd.com",
  "issuu.com",
  "coursehero.com",
  "academia.edu",
  "pdfdrive.com",
  "z-lib.org"
]);

function isLikelyLowSignalSource(url: string, sourceDomain: string | null): boolean {
  const normalizedUrl = url.toLowerCase();
  const domain = sourceDomain?.toLowerCase() ?? "";

  if (KNOWN_LOW_SIGNAL_DOMAINS.has(domain)) {
    return true;
  }

  if (normalizedUrl.endsWith(".pdf") && !domain.endsWith(".edu") && !domain.endsWith(".gov")) {
    return true;
  }

  return false;
}

describe("discovery live integration quality eval", () => {
  it.skipIf(!LIVE_TEST_FLAG || !HAS_DISCOVERY_KEY)(
    "runs full PR6 discovery path against Tavily and enforces quality gates",
    async () => {
      const result = await runDiscovery({
        interestMemoryText: memory,
        targetCount: 10,
        maxRetries: 3,
        maxTopics: 8,
        perTopicResults: 4
      });

      const distinctDomains = new Set(result.candidates.map((candidate) => candidate.sourceDomain).filter(Boolean));
      const distinctTopics = new Set(result.candidates.map((candidate) => candidate.topic));
      const highlightedCount = result.candidates.filter((candidate) => Boolean(candidate.highlight)).length;
      const highlightCoverage = result.candidates.length === 0 ? 0 : highlightedCount / result.candidates.length;
      const lowSignalCandidates = result.candidates.filter((candidate) =>
        isLikelyLowSignalSource(candidate.url, candidate.sourceDomain)
      );
      const lowSignalRatio = result.candidates.length === 0 ? 1 : lowSignalCandidates.length / result.candidates.length;

      console.log("\\nLIVE_DISCOVERY_EVAL_START");
      for (const [index, candidate] of result.candidates.entries()) {
        console.log(
          `${index + 1}. [${candidate.topic}] ${candidate.title} | ${candidate.sourceDomain} | score=${candidate.sourceScore} | ${candidate.url}`
        );
        console.log(`   highlight: ${candidate.highlight}`);
      }
      console.log(`warnings: ${JSON.stringify(result.warnings)}`);
      console.log(`attempts: ${result.attempts}`);
      console.log(`metrics: ${JSON.stringify({
        candidateCount: result.candidates.length,
        distinctDomainCount: distinctDomains.size,
        distinctTopicCount: distinctTopics.size,
        highlightCoverage,
        lowSignalRatio,
        diversityCard: result.diversityCard
      })}`);
      if (lowSignalCandidates.length > 0) {
        console.log(`low_signal_candidates: ${JSON.stringify(
          lowSignalCandidates.map((candidate) => ({
            topic: candidate.topic,
            sourceDomain: candidate.sourceDomain,
            url: candidate.url
          }))
        )}`);
      }
      console.log("LIVE_DISCOVERY_EVAL_END\\n");

      expect(result.candidates.length).toBeGreaterThanOrEqual(MIN_CANDIDATE_COUNT);
      expect(result.candidates.every((candidate) => candidate.softSuppressed === false)).toBe(true);
      expect(distinctDomains.size).toBeGreaterThanOrEqual(MIN_DISTINCT_DOMAINS);
      expect(distinctTopics.size).toBeGreaterThanOrEqual(MIN_DISTINCT_TOPICS);
      expect(highlightCoverage).toBeGreaterThanOrEqual(MIN_HIGHLIGHT_COVERAGE);
      expect(lowSignalRatio).toBeLessThanOrEqual(MAX_LOW_SIGNAL_RATIO);
      expect(result.diversityCard.passes).toBe(true);
    },
    120000
  );

});
