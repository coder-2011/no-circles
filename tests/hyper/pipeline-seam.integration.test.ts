import { afterEach, describe, expect, it, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
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
  it("runs discovery -> summary seam and outputs ten final items", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5";

    const topicUrls = new Map<string, string>();
    const exaSearch = vi.fn(async ({ query }: { query: string; numResults: number }) => {
      const topic = query.split(" prefers ")[0]?.trim() || query;
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const url = `https://example.com/${slug}`;
      topicUrls.set(url, topic);

      return [
        {
          url,
          title: `${topic} guide`,
          highlights: [
            `The article explains concrete implementation tradeoffs for ${topic}.`,
            `It includes practical architecture and rollout decisions for ${topic}.`
          ],
          score: 0.82
        }
      ];
    });

    const fetchMock = vi.fn(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = payload.messages?.[0]?.content ?? "";
      const titleLine = prompt
        .split("\n")
        .find((line) => line.startsWith("Original title: "))
        ?.replace("Original title: ", "")
        ?.trim();

      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: titleLine || "Refined title",
                summary:
                  "This piece explains the main implementation decision, the operating constraints, and the practical tradeoffs teams considered before rollout and adoption across production systems."
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

    const summaries = await generateNewsletterSummaries({
      items: discovery.candidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title ?? "Untitled",
        highlights: candidate.highlights,
        topic: candidate.topic
      })),
      targetWords: 50
    });

    const runId = buildRunId("pipeline-seam");
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

    expect(discovery.candidates).toHaveLength(10);
    expect(summaries).toHaveLength(10);
    expect(summaries.every((item) => Boolean(item.title && item.summary && item.url))).toBe(true);
    expect(summaries.every((item, index) => item.url === discovery.candidates[index]?.url)).toBe(true);
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
