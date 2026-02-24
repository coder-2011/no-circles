import { describe, expect, it } from "vitest";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_QUOTE_MODEL && !process.env.ANTHROPIC_SUMMARY_MODEL && !process.env.ANTHROPIC_MEMORY_MODEL) {
    missing.push("ANTHROPIC_QUOTE_MODEL|ANTHROPIC_SUMMARY_MODEL|ANTHROPIC_MEMORY_MODEL");
  }
  return missing;
}

describe("hyper integration: personalized quote selection live", () => {
  it.skipIf(missingLiveEnv().length > 0)("fetches live dataset rows and selects one personalized quote with Claude", async () => {
    const { selectPersonalizedQuote } = await import("@/lib/quotes/select-personalized-quote");

    const interestMemoryText = [
      "PERSONALITY:",
      "- pragmatic",
      "- prefers first-principles explanations",
      "",
      "ACTIVE_INTERESTS:",
      "- software architecture",
      "- AI systems",
      "",
      "SUPPRESSED_INTERESTS:",
      "- generic motivational content",
      "",
      "RECENT_FEEDBACK:",
      "- less hype, more concrete tradeoffs",
      "- prefer implementation detail over slogans"
    ].join("\n");

    const result = await selectPersonalizedQuote({
      userId: "hyper-live-user",
      localIssueDate: new Date().toISOString().slice(0, 10),
      interestMemoryText,
      candidateCount: 50,
      shortlistCount: 20
    });

    const runId = buildRunId("quote-selection-live");
    await writeHyperLog({
      group: "pipeline-seam",
      runId,
      fileName: "quote-selection-result.txt",
      content: toPrettyJson({
        userId: "hyper-live-user",
        localIssueDate: new Date().toISOString().slice(0, 10),
        result
      })
    });

    expect(result.text.trim().length).toBeGreaterThan(20);
    expect(result.author.trim().length).toBeGreaterThan(1);
  });
});
