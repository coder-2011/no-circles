import { describe, expect, it } from "vitest";
import { runBiDailyReflection } from "@/lib/memory/reflection";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const CURRENT_MEMORY = [
  "PERSONALITY:",
  "- Curious across science, technology, history, strategy, creativity, and practical life decisions.",
  "- Prefers evidence first writing, clear mechanisms, and useful takeaways.",
  "- Likes balanced novelty with depth and low hype language.",
  "",
  "ACTIVE_INTERESTS:",
  "- Artificial intelligence safety and governance in practice",
  "- Distributed systems reliability and performance",
  "- Product strategy and user behavior research",
  "- Behavioral economics and decision science",
  "- Evolutionary biology and cognitive science",
  "- Neuroscience and learning science",
  "- History of science and technology",
  "- Economic history and geopolitical shifts",
  "",
  "RECENT_FEEDBACK:",
  "- Wants broad, surprising, high signal daily briefs with concrete evidence.",
  "- Keep tone neutral, concise, and practical."
].join("\n");

const RECENT_SENT_EMAILS = [
  {
    createdAt: "2026-03-01T15:55:00.000Z",
    subject: "No Circles: broad issue 1",
    bodyText: [
      "Issue 1",
      "A broad future-of-AI essay with little operational detail.",
      "A general strategy piece about innovation and leadership.",
      "A history item framed mainly as narrative overview."
    ].join("\n"),
    providerMessageId: "seed-sent-1",
    issueVariant: "daily"
  },
  {
    createdAt: "2026-03-02T15:55:00.000Z",
    subject: "No Circles: broad issue 2",
    bodyText: [
      "Issue 2",
      "Another broad AI governance article without mechanisms.",
      "A trend piece on product strategy.",
      "A high-level essay on society and technology."
    ].join("\n"),
    providerMessageId: "seed-sent-2",
    issueVariant: "daily"
  },
  {
    createdAt: "2026-03-03T15:55:00.000Z",
    subject: "No Circles: broad issue 3",
    bodyText: [
      "Issue 3",
      "A generic piece about where AI is going.",
      "A broad explainer on incentives and policy.",
      "A soft narrative article about scientific progress."
    ].join("\n"),
    providerMessageId: "seed-sent-3",
    issueVariant: "daily"
  }
] as const;

const RECENT_REPLY_EMAILS = [
  {
    createdAt: "2026-03-01T18:00:00.000Z",
    subject: "Re: No Circles",
    bodyText:
      "This is too broad. I want distributed systems reliability, observability, failure analysis, and concrete implementation tradeoffs."
  },
  {
    createdAt: "2026-03-02T18:00:00.000Z",
    subject: "Re: No Circles",
    bodyText:
      "Please lean toward mechanisms, bottlenecks, benchmarks, and operational constraints. Less narrative overview."
  },
  {
    createdAt: "2026-03-03T18:00:00.000Z",
    subject: "Re: No Circles",
    bodyText:
      "I read like a builder and optimizer. I care about what worked in practice, tradeoffs, failure modes, and decision rules."
  },
  {
    createdAt: "2026-03-04T18:00:00.000Z",
    subject: "Re: No Circles",
    bodyText:
      "This is a durable preference, not a temporary mood. Keep neuroscience, learning science, and history of science when they help explain skill-building and system design in practical terms."
  }
] as const;

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_REFLECTION_MODEL && !process.env.ANTHROPIC_MEMORY_MODEL) {
    missing.push("ANTHROPIC_REFLECTION_MODEL|ANTHROPIC_MEMORY_MODEL");
  }
  return missing;
}

describe("hyper integration: seeded-history reflection rewrite live", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "rewrites memory when broad recent issues conflict with repeated builder-style replies",
    async () => {
      const runId = buildRunId("reflection-seeded-history-live");
      const runAtUtc = new Date("2026-03-05T16:05:00.000Z");

      await writeHyperLog({
        group: "reflection-seeded-history",
        runId,
        fileName: "00-current-memory.txt",
        content: CURRENT_MEMORY
      });
      await writeHyperLog({
        group: "reflection-seeded-history",
        runId,
        fileName: "01-recent-sent-emails.txt",
        content: toPrettyJson(RECENT_SENT_EMAILS)
      });
      await writeHyperLog({
        group: "reflection-seeded-history",
        runId,
        fileName: "02-recent-reply-emails.txt",
        content: toPrettyJson(RECENT_REPLY_EMAILS)
      });

      const result = await runBiDailyReflection({
        userId: "hyper-reflection-seeded-history-user",
        timezone: "America/Los_Angeles",
        runAtUtc,
        currentMemoryText: CURRENT_MEMORY,
        recentSentEmails: [...RECENT_SENT_EMAILS],
        recentReplyEmails: [...RECENT_REPLY_EMAILS]
      });

      await writeHyperLog({
        group: "reflection-seeded-history",
        runId,
        fileName: "03-reflection-result.txt",
        content: toPrettyJson(result)
      });
      await writeHyperLog({
        group: "reflection-seeded-history",
        runId,
        fileName: "04-reflected-memory.txt",
        content: result.memoryText
      });

      expect(result.reviewedAt.toISOString()).toBe(runAtUtc.toISOString());
      expect(result.decision).toBe("rewrite");
      expect(result.memoryText).toContain("PERSONALITY:");
      expect(result.memoryText).toContain("ACTIVE_INTERESTS:");
      expect(result.memoryText).toContain("RECENT_FEEDBACK:");
      expect(result.memoryText.toLowerCase()).toContain("builder");
      expect(result.memoryText.toLowerCase()).toContain("optimizer");
      expect(result.memoryText.toLowerCase()).toContain("mechanisms");
      expect(result.discoveryBrief.avoidPatterns.length).toBeGreaterThan(0);
      expect(result.discoveryBrief.preferredAngles.length).toBeGreaterThan(0);
    },
    240000
  );
});
