import { describe, expect, it } from "vitest";
import { formatOnboardingMemory } from "@/lib/memory/processors";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const BRAIN_DUMP = [
  "I care about AI engineering, distributed systems, software architecture, and data engineering.",
  "I like practical implementation details, migration tradeoffs, and operational lessons.",
  "I want less hype and more concrete examples from production environments.",
  "I also like product strategy and behavioral economics when they connect to engineering decisions."
].join(" ");

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.TAVILY_API_KEY) missing.push("TAVILY_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_MEMORY_MODEL) missing.push("ANTHROPIC_MEMORY_MODEL");
  return missing;
}

describe("hyper integration: full system live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "runs brain dump -> onboarding memory -> discovery -> summary and writes trace logs",
    async () => {
      const runId = buildRunId("full-system-live");
      const interestMemoryText = await formatOnboardingMemory(BRAIN_DUMP);

      const discovery = await runDiscovery({
        interestMemoryText,
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

      await writeHyperLog({
        group: "full-system",
        runId,
        fileName: "input-brain-dump.txt",
        content: BRAIN_DUMP
      });
      await writeHyperLog({
        group: "full-system",
        runId,
        fileName: "interest-memory.txt",
        content: interestMemoryText
      });
      await writeHyperLog({
        group: "full-system",
        runId,
        fileName: "query-planner-trace.txt",
        content: toPrettyJson(discovery.queryPlannerTrace ?? null)
      });
      await writeHyperLog({
        group: "full-system",
        runId,
        fileName: "discovery-output.txt",
        content: toPrettyJson(discovery)
      });
      await writeHyperLog({
        group: "full-system",
        runId,
        fileName: "claude-summary-output.txt",
        content: toPrettyJson(summaries)
      });

      expect(discovery.candidates).toHaveLength(10);
      expect(summaries).toHaveLength(10);
      expect(summaries.every((item) => item.url.startsWith("http"))).toBe(true);
      expect(summaries.every((item) => item.summary.length > 0)).toBe(true);
    },
    240000
  );
});
