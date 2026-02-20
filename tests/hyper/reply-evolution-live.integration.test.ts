import { describe, expect, it } from "vitest";
import { formatOnboardingMemory, mergeReplyIntoMemory } from "@/lib/memory/processors";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const INITIAL_BRAIN_DUMP = [
  "I am focused on AI engineering, systems design, and software architecture.",
  "I prefer concrete implementation guidance over broad thought pieces.",
  "I also enjoy data engineering and technical product strategy."
].join(" ");

const REPLY_UPDATE = [
  "Pause software architecture and product strategy for now.",
  "I want much more distributed systems, databases, and observability.",
  "Keep it practical and implementation focused."
].join(" ");

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.PERPLEXITY_API_KEY) missing.push("PERPLEXITY_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_MEMORY_MODEL) missing.push("ANTHROPIC_MEMORY_MODEL");
  return missing;
}

async function discoverAndSummarize(memory: string) {
  const discovery = await runDiscovery({
    interestMemoryText: memory,
    targetCount: 10,
    maxRetries: 3,
    maxTopics: 10,
    perTopicResults: 4
  });

  const summaries = await generateNewsletterSummaries({
    items: discovery.candidates.map((candidate) => ({
      url: candidate.url,
      title: candidate.title ?? "Untitled",
      highlights: candidate.highlights,
      topic: candidate.topic
    })),
    targetWords: 50
  });

  return { discovery, summaries };
}

describe("hyper integration: reply evolution live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "runs before/after pipeline and logs how next email output changes after reply update",
    async () => {
      const runId = buildRunId("reply-evolution-live");
      const memoryBefore = await formatOnboardingMemory(INITIAL_BRAIN_DUMP);
      const before = await discoverAndSummarize(memoryBefore);

      const memoryAfter = await mergeReplyIntoMemory(memoryBefore, REPLY_UPDATE);
      const after = await discoverAndSummarize(memoryAfter);

      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "00-input-brain-dump.txt",
        content: INITIAL_BRAIN_DUMP
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "01-reply-update.txt",
        content: REPLY_UPDATE
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "02-memory-before.txt",
        content: memoryBefore
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "03-memory-after.txt",
        content: memoryAfter
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "04-exa-before.txt",
        content: toPrettyJson(before.discovery)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "05-exa-after.txt",
        content: toPrettyJson(after.discovery)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "06-summary-before.txt",
        content: toPrettyJson(before.summaries)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "07-summary-after.txt",
        content: toPrettyJson(after.summaries)
      });

      expect(memoryAfter).not.toEqual(memoryBefore);
      expect(before.discovery.candidates).toHaveLength(10);
      expect(after.discovery.candidates).toHaveLength(10);
      expect(before.summaries).toHaveLength(10);
      expect(after.summaries).toHaveLength(10);
    },
    240000
  );
});
