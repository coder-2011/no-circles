import { afterEach, describe, expect, it, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn()
  }
}));

import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";
import { encodeBloomBitsBase64, mightContainCanonicalUrl, normalizeBloomStateFromUserRow } from "@/lib/bloom/user-url-bloom";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalSummaryModel = process.env.ANTHROPIC_SUMMARY_MODEL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env.ANTHROPIC_API_KEY = originalApiKey;
  process.env.ANTHROPIC_SUMMARY_MODEL = originalSummaryModel;
});

const memory = [
  "PERSONALITY:",
  "- prefers practical explainers",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- distributed systems",
  "- software architecture",
  "- developer productivity",
  "- data engineering",
  "- cloud cost optimization",
  "- observability",
  "- testing strategy",
  "- product analytics",
  "- programming languages",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- less hype, more implementation detail"
].join("\n");

describe("hyper integration: pipeline seam", () => {
  it("runs through PR9 pipeline seam and applies Bloom suppression across runs", async () => {
    const mutableUser = {
      id: "user-hyper-1",
      email: "hyper@example.com",
      preferredName: "Hyper",
      timezone: "UTC",
      interestMemoryText: memory,
      sentUrlBloomBits: null as string | null
    };

    const runDiscoveryFn = vi.fn(async (_input, deps?: { includeCandidate?: (candidate: { canonicalUrl: string }) => boolean }) => {
      const allCandidates = Array.from({ length: 20 }).map((_, index) => {
        const suffix = index < 10 ? "a" : "b";
        const topicNumber = index < 10 ? index + 1 : index - 9;
        const canonicalUrl = `https://example.com/topic-${topicNumber}-${suffix}`;
        return {
          url: canonicalUrl,
          canonicalUrl,
          title: `topic ${topicNumber} ${suffix}`,
          highlight: `highlight ${topicNumber} ${suffix}`,
          highlights: [`highlight ${topicNumber} ${suffix}`],
          topic: `topic-${topicNumber}`,
          topicRank: topicNumber - 1,
          softSuppressed: false,
          resultRank: suffix === "a" ? 0 : 1,
          sourceDomain: "example.com",
          publishedAt: null,
          sourceScore: 0.9,
          highlightScore: 0.8,
          highlightScores: [0.8]
        };
      });

      const filtered = deps?.includeCandidate ? allCandidates.filter((candidate) => deps.includeCandidate?.(candidate)) : allCandidates;
      return {
        candidates: filtered.slice(0, 10),
        topics: [],
        attempts: 1,
        warnings: [],
        diversityCard: {
          itemCount: Math.min(10, filtered.length),
          targetCount: 10,
          distinctTopics: Math.min(10, filtered.length),
          distinctDomains: 1,
          maxTopicShare: 0.1,
          maxDomainShare: 1,
          topicEntropyNormalized: 1,
          thresholds: {
            minDistinctTopics: 6,
            maxTopicShare: 0.3,
            minDistinctDomains: 6,
            maxDomainShare: 0.3
          },
          passes: true
        }
      };
    });

    const summaryUrlRuns: string[][] = [];

    const runOnce = async (runAtUtc: Date) => {
      return sendUserNewsletter(
        { userId: mutableUser.id, runAtUtc },
        {
          loadUserFn: async () => ({ ...mutableUser }),
          runDiscoveryFn,
          generateSummariesFn: async ({ items }) => {
            summaryUrlRuns.push(items.map((item) => item.url));
            return items.map((item) => ({ title: item.title, url: item.url, summary: "summary" }));
          },
          sendNewsletterFn: async () => ({ ok: true, providerMessageId: "msg_hyper", attempts: 1, error: null }),
          reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
          markIdempotencyFailedFn: async () => undefined,
          persistSendSuccessFn: async ({ bloomState, runAtUtc: persistedRunAtUtc }) => {
            mutableUser.sentUrlBloomBits = encodeBloomBitsBase64(bloomState);
            void persistedRunAtUtc;
          }
        }
      );
    };

    const first = await runOnce(new Date("2026-02-16T10:00:00.000Z"));
    const second = await runOnce(new Date("2026-02-17T10:00:00.000Z"));

    const firstUrls = summaryUrlRuns[0] ?? [];
    const secondUrls = summaryUrlRuns[1] ?? [];
    const overlap = firstUrls.filter((url) => secondUrls.includes(url));
    const bloomStateAfterFirst = normalizeBloomStateFromUserRow(mutableUser);

    const runId = buildRunId("pipeline-seam");
    await writeHyperLog({
      group: "pipeline-seam",
      runId,
      fileName: "discovery-output.txt",
      content: toPrettyJson({ first, second, firstUrls, secondUrls, overlap })
    });
    await writeHyperLog({
      group: "pipeline-seam",
      runId,
      fileName: "summary-output.txt",
      content: toPrettyJson({ firstUrls, secondUrls })
    });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(firstUrls).toHaveLength(10);
    expect(secondUrls).toHaveLength(10);
    expect(overlap).toEqual([]);
    expect(firstUrls.every((url) => mightContainCanonicalUrl(bloomStateAfterFirst, url))).toBe(true);
  });

  it("handles mixed model failures with one retry and preserves full output count", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      const topic = query.split(" prefers ")[0]?.trim() || query;
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      return [
        {
          url: `https://example.com/${slug}`,
          title: `${topic} report`,
          highlights: [
            `A practical report for ${topic} with concrete implementation details.`,
            `It compares reliability, cost, and rollout tradeoffs.`
          ],
          score: 0.8
        }
      ];
    });

    const forcedFailureUrls = new Set<string>();
    const fetchMock = vi.fn(async (requestUrl: string, init: RequestInit) => {
      void requestUrl;
      const payload = JSON.parse(String(init.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = payload.messages?.[0]?.content ?? "";
      const urlLine = prompt
        .split("\n")
        .find((line) => line.startsWith("URL (reference only): "))
        ?.replace("URL (reference only): ", "")
        ?.trim();
      const shouldFailItem = urlLine ? forcedFailureUrls.has(urlLine) : false;
      const titleLine = prompt
        .split("\n")
        .find((line) => line.startsWith("Original title: "))
        ?.replace("Original title: ", "")
        ?.trim();

      if (shouldFailItem) {
        return {
          ok: true,
          json: async () => ({ content: [{ type: "text", text: "not json" }] })
        };
      }

      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: titleLine || "fallback-title",
                summary:
                  "The writeup explains implementation constraints, key architectural decisions, and practical tradeoffs for rollout under production reliability requirements."
              })
            }
          ]
        })
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const discovery = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 10,
        maxRetries: 1,
        maxTopics: 10,
        perTopicResults: 1
      },
      { exaSearch }
    );

    const forcedTargets = [discovery.candidates[2]?.url, discovery.candidates[6]?.url].filter(
      (value): value is string => Boolean(value)
    );
    forcedTargets.forEach((url) => forcedFailureUrls.add(url));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const summaries = await generateNewsletterSummaries({
      items: discovery.candidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title ?? "Untitled",
        highlights: candidate.highlights,
        topic: candidate.topic
      })),
      targetWords: 50
    });

    const runId = buildRunId("pipeline-seam-failure");
    await writeHyperLog({
      group: "pipeline-seam",
      runId,
      fileName: "discovery-output.txt",
      content: toPrettyJson(discovery)
    });
    await writeHyperLog({
      group: "pipeline-seam",
      runId,
      fileName: "summary-output.txt",
      content: toPrettyJson(summaries)
    });

    expect(summaries).toHaveLength(10);
    const fallbackWarnSeen = warnSpy.mock.calls.some((call) => String(call[0]).includes("summary_fallback_used"));
    const runCompleteEvents = infoSpy.mock.calls
      .map((call) => {
        try {
          return JSON.parse(String(call[0])) as { event?: string; fallback_count?: number };
        } catch {
          return null;
        }
      })
      .filter((event): event is { event?: string; fallback_count?: number } => event !== null);
    const fallbackCount = runCompleteEvents.find((event) => event.event === "summary_run_complete")?.fallback_count ?? 0;

    expect(fallbackWarnSeen).toBe(true);
    expect(fallbackCount).toBeGreaterThan(0);
  });
});
