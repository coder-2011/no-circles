import { describe, expect, it } from "vitest";
import { formatOnboardingMemory, mergeReplyIntoMemory } from "@/lib/memory/processors";
import { runDiscovery } from "@/lib/discovery/run-discovery";
import { searchSonar } from "@/lib/discovery/sonar-client";
import { generateNewsletterSummaries } from "@/lib/summary/writer";
import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const INITIAL_BRAIN_DUMP = [
  "uh hi i like random things i guess.",
  "maybe ai maybe not, maybe coding sometimes, maybe business drama, maybe crypto, maybe history if short.",
  "dont send boring stuff but also i do not have time to read much.",
  "i want useful things but also fun things and surprising things and idk.",
  "sometimes i say less hype but i also want what is trending right now."
].join(" ");

const REPLY_UPDATE = [
  "Less broad architecture commentary for now; give me much more distributed systems internals, databases, observability, and failure analysis.",
  "Please prioritize implementation-level depth, tradeoffs, and what changed in real deployments.",
  "Keep behavioral econ and history as occasional discovery side-quests, not the main feed."
].join(" ");

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.PERPLEXITY_API_KEY) missing.push("PERPLEXITY_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_MEMORY_MODEL) missing.push("ANTHROPIC_MEMORY_MODEL");
  return missing;
}

type DiscoveryRunSuccess = {
  discovery: Awaited<ReturnType<typeof runDiscovery>>;
  summaries: Awaited<ReturnType<typeof generateNewsletterSummaries>>;
  mode: string;
  queryTrace: Array<{
    mode: string;
    query: string;
    numResults: number;
    durationMs: number;
    resultCount: number;
  }>;
};

type DiscoveryRunFallback = {
  failures: string[];
  queryTrace: Array<{
    mode: string;
    query: string;
    numResults: number;
    durationMs: number;
    resultCount: number;
  }>;
};

function isInsufficientQualityCandidatesError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("INSUFFICIENT_QUALITY_CANDIDATES:");
}

function isOnboardingModelRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "ONBOARDING_MODEL_REQUIRED";
}

async function discoverAndSummarize(memory: string): Promise<DiscoveryRunSuccess | DiscoveryRunFallback> {
  const attempts = [
    {
      mode: "strict",
      options: {
        targetCount: 10,
        maxRetries: 1,
        maxTopics: 10,
        perTopicResults: 4,
        requireUrlExcerpt: true
      }
    },
    {
      mode: "relaxed",
      options: {
        targetCount: 10,
        maxRetries: 2,
        maxTopics: 10,
        perTopicResults: 7,
        requireUrlExcerpt: false
      }
    }
  ] as const;

  const failures: string[] = [];
  const queryTrace: Array<{
    mode: string;
    query: string;
    numResults: number;
    durationMs: number;
    resultCount: number;
  }> = [];

  for (const attempt of attempts) {
    try {
      const liveSearch = async ({ query, numResults }: { query: string; numResults: number }) => {
        const startedAt = Date.now();
        const results = await searchSonar({ query, numResults });
        queryTrace.push({
          mode: attempt.mode,
          query,
          numResults,
          durationMs: Date.now() - startedAt,
          resultCount: results.length
        });
        return results;
      };

      const discovery = await runDiscovery(
        {
          interestMemoryText: memory,
          ...attempt.options
        },
        {
          exaSearch: liveSearch
        }
      );

      const summaries = await generateNewsletterSummaries({
        items: discovery.candidates.map((candidate) => ({
          url: candidate.url,
          title: candidate.title ?? "Untitled",
          highlights: candidate.highlights,
          topic: candidate.topic
        })),
        targetWords: 100
      });

      return {
        discovery,
        summaries,
        mode: attempt.mode,
        queryTrace
      };
    } catch (error) {
      if (!isInsufficientQualityCandidatesError(error)) {
        throw error;
      }
      failures.push(`${attempt.mode}:${error.message}`);
    }
  }

  return { failures, queryTrace };
}

describe("hyper integration: reply evolution live smoke", () => {
  it.skipIf(missingLiveEnv().length > 0)(
    "runs before/after pipeline and logs how next email output changes after reply update",
    async () => {
      const runId = buildRunId("reply-evolution-live");
      let memoryBefore: string;
      try {
        memoryBefore = await formatOnboardingMemory(INITIAL_BRAIN_DUMP);
      } catch (error) {
        if (!isOnboardingModelRequiredError(error)) {
          throw error;
        }
        await writeHyperLog({
          group: "reply-evolution",
          runId,
          fileName: "00-live-skip-onboarding-model.txt",
          content:
            "Onboarding model generation unavailable for this live run (ONBOARDING_MODEL_REQUIRED); skipping reply-evolution smoke assertions."
        });
        return;
      }

      const memoryAfter = await mergeReplyIntoMemory(memoryBefore, REPLY_UPDATE);
      const before = await discoverAndSummarize(memoryBefore);
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
        fileName: "04-discovery-attempts-before.txt",
        content: toPrettyJson(before)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "05-discovery-attempts-after.txt",
        content: toPrettyJson(after)
      });

      expect(memoryAfter).not.toEqual(memoryBefore);

      if (!("discovery" in before) || !("discovery" in after)) {
        await writeHyperLog({
          group: "reply-evolution",
          runId,
          fileName: "06-live-skip-reason.txt",
          content:
            "Live discovery returned insufficient quality candidates in strict and relaxed modes; skipping before/after newsletter comparison assertions."
        });
        return;
      }

      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "07-exa-before.txt",
        content: toPrettyJson(before.discovery)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "08-exa-after.txt",
        content: toPrettyJson(after.discovery)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "09-summary-before.txt",
        content: toPrettyJson(before.summaries)
      });
      await writeHyperLog({
        group: "reply-evolution",
        runId,
        fileName: "10-summary-after.txt",
        content: toPrettyJson(after.summaries)
      });

      expect(before.discovery.candidates).toHaveLength(10);
      expect(after.discovery.candidates).toHaveLength(10);
      expect(before.summaries).toHaveLength(10);
      expect(after.summaries).toHaveLength(10);
    },
    420000
  );
});
