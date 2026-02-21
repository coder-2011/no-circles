import { describe, expect, it } from "vitest";
import { formatOnboardingMemory } from "@/lib/memory/processors";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const BRAIN_DUMP = [
  "Okay so brain dump, messy version: I care a lot about AI engineering + coding with agents (what works in prod, what breaks, why).",
  "I want practical deep dives: migrations, incident postmortems, benchmarks, architecture tradeoffs, reliability constraints, and cost/perf tradeoffs in real systems.",
  "I’m also into distributed systems + software architecture + data engineering, but please not generic SEO explainers or fluffy trend recaps.",
  "Outside pure eng: philosophy of science, political history, behavioral economics, evolutionary biology, and science-driven writing all interest me.",
  "I like pieces that teach mechanisms and decision frameworks, not just event announcements, conference pages, institutional boilerplate, or admin updates.",
  "Recency matters a lot for AI tools/APIs/platform workflows and security incidents; less so for timeless domains where best explainers may be older.",
  "Tone preference: neutral, evidence-first, concrete, with uncertainty when needed. Less hype. More first-hand detail, failure modes, constraints, and what changed in practice.",
  "If possible include a little serendipity but keep it adjacent to my interests and high-signal."
].join(" ");

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.PERPLEXITY_API_KEY) missing.push("PERPLEXITY_API_KEY");
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
        maxRetries: 1,
        maxTopics: 10,
        perTopicResults: 4,
        requireUrlExcerpt: true
      });

      const summaries = await generateNewsletterSummaries({
        items: discovery.candidates.map((candidate) => ({
          url: candidate.url,
          title: candidate.title ?? "Untitled",
          highlights: candidate.highlights,
          topic: candidate.topic
        })),
        targetWords: 100
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
        fileName: "exa-discovery-output.txt",
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
