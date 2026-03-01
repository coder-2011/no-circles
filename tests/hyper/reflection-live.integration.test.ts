import { describe, expect, it } from "vitest";
import { runBiDailyReflection } from "@/lib/memory/reflection";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const CURRENT_MEMORY = [
  "PERSONALITY:",
  "- prefers concrete explanations",
  "- values grounded analysis over hype",
  "",
  "ACTIVE_INTERESTS:",
  "- ai infrastructure",
  "- industrial policy",
  "",
  "RECENT_FEEDBACK:",
  "- wants useful analysis"
].join("\n");

const RECENT_SENT_EMAILS = [
  {
    createdAt: "2026-02-13T14:00:00.000Z",
    subject: "No Circles: AI infra and policy",
    bodyText: [
      "day 1",
      "GPU supply-chain bottlenecks and export controls",
      "Inference cost optimization at scale",
      "Another broad future-of-AI essay"
    ].join("\n"),
    providerMessageId: "sent-1",
    issueVariant: "daily"
  },
  {
    createdAt: "2026-02-14T14:00:00.000Z",
    subject: "No Circles: more AI systems",
    bodyText: [
      "day 2",
      "Serving architecture for large models",
      "Datacenter energy constraints",
      "Another broad future-of-AI essay"
    ].join("\n"),
    providerMessageId: "sent-2",
    issueVariant: "daily"
  }
] as const;

const RECENT_REPLY_EMAILS = [
  {
    createdAt: "2026-02-14T18:30:00.000Z",
    subject: "Re: No Circles",
    bodyText: [
      "Less generic future-of-AI framing.",
      "More things that help me understand how people learn and build skill.",
      "I usually read like a builder: I want mechanisms, constraints, tradeoffs, and what works in practice."
    ].join(" ")
  },
  {
    createdAt: "2026-02-15T08:15:00.000Z",
    subject: "Re: No Circles",
    bodyText: [
      "Keep industrial policy, but treat it as part of the implementation story.",
      "I care more about systems, incentives, and operational detail than narrative debate."
    ].join(" ")
  }
] as const;

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    missing.push("OPENROUTER_API_KEY|ANTHROPIC_API_KEY");
  }
  if (
    !process.env.OPENROUTER_REFLECTION_MODEL &&
    !process.env.OPENROUTER_MEMORY_MODEL &&
    !process.env.ANTHROPIC_REFLECTION_MODEL &&
    !process.env.ANTHROPIC_MEMORY_MODEL
  ) {
    missing.push("OPENROUTER_REFLECTION_MODEL|OPENROUTER_MEMORY_MODEL|ANTHROPIC_REFLECTION_MODEL|ANTHROPIC_MEMORY_MODEL");
  }
  return missing;
}

describe("hyper integration: caring reflection live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "runs the live metacognitive reflection pass and records its output",
    async () => {
      const runId = buildRunId("reflection-live");
      const runAtUtc = new Date("2026-02-16T10:00:00.000Z");

      await writeHyperLog({
        group: "reflection-live",
        runId,
        fileName: "00-current-memory.txt",
        content: CURRENT_MEMORY
      });
      await writeHyperLog({
        group: "reflection-live",
        runId,
        fileName: "01-recent-sent-emails.txt",
        content: toPrettyJson(RECENT_SENT_EMAILS)
      });
      await writeHyperLog({
        group: "reflection-live",
        runId,
        fileName: "02-recent-reply-emails.txt",
        content: toPrettyJson(RECENT_REPLY_EMAILS)
      });

      const result = await runBiDailyReflection({
        userId: "hyper-reflection-live-user",
        timezone: "UTC",
        runAtUtc,
        currentMemoryText: CURRENT_MEMORY,
        recentSentEmails: [...RECENT_SENT_EMAILS],
        recentReplyEmails: [...RECENT_REPLY_EMAILS]
      });

      await writeHyperLog({
        group: "reflection-live",
        runId,
        fileName: "03-reflection-result.txt",
        content: toPrettyJson(result)
      });
      await writeHyperLog({
        group: "reflection-live",
        runId,
        fileName: "04-reflected-memory.txt",
        content: result.memoryText
      });

      expect(result.reviewedAt.toISOString()).toBe(runAtUtc.toISOString());
      expect(["no_change", "rewrite"]).toContain(result.decision);
      expect(result.memoryText).toContain("PERSONALITY:");
      expect(result.memoryText).toContain("ACTIVE_INTERESTS:");
      expect(result.memoryText).toContain("RECENT_FEEDBACK:");
      expect(Array.isArray(result.discoveryBrief.reinforceTopics)).toBe(true);
      expect(Array.isArray(result.discoveryBrief.avoidPatterns)).toBe(true);
      expect(Array.isArray(result.discoveryBrief.preferredAngles)).toBe(true);
      expect(Array.isArray(result.discoveryBrief.noveltyMoves)).toBe(true);
    },
    240000
  );
});
