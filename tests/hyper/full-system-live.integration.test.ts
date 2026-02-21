import { describe, expect, it } from "vitest";
import { formatOnboardingMemory } from "@/lib/memory/processors";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const BRAIN_DUMP = [
  "Messy but real brain dump: I want a genuinely mixed daily brief, not mostly tech.",
  "Give me strong pieces across AI/software, global politics/history, economics and business strategy, climate/energy, biology and medicine, psychology, design/architecture, and arts/literature.",
  "I still care about engineering depth (postmortems, system tradeoffs, reliability lessons), but cap pure engineering to a minority of the issue.",
  "For policy/history, prioritize concrete analyses of institutions, geopolitical shifts, governance experiments, and second-order effects.",
  "For science, include mechanistic explainers and major results in biology, neuroscience, physics, and public health; avoid press-release fluff.",
  "For economics/business, I want market structure, incentives, labor/productivity, industrial policy, and company strategy with evidence.",
  "For arts/culture, include architecture, film, music, literature, and cultural history when there is deep context and clear learning value.",
  "I like synthesis and transfer: what lessons from one domain can improve decisions in another.",
  "Please avoid logistics pages (events, conference schedules, registration, job posts, generic department pages, vendor landing pages).",
  "Prefer authoritative primary or high-trust secondary sources: major research institutions, established publications, official datasets, and serious analysis outlets.",
  "Avoid press releases, generic listicles, AI-generated roundups, thin aggregation blogs, and pages dominated by navigation text.",
  "Tone: neutral, high-signal, specific, evidence-first, with uncertainty called out where needed.",
  "Recency should be adaptive: fast-moving domains can be fresh; timeless topics can use older but authoritative sources.",
  "Add a little serendipity each day, but keep everything substantive."
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
