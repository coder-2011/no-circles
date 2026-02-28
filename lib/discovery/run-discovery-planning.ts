import { deriveTopicsFromMemory, extractTopicPoolsFromMemory } from "@/lib/discovery/topic-derivation";
import { selectSerendipityTopics } from "@/lib/discovery/haiku-serendipity-selector";
import type { DiscoveryRunInput, DiscoveryRunResult } from "@/lib/discovery/types";

const DEFAULT_SERENDIPITY_TARGET_COUNT = 2;

function selectActiveTopicsRandomly(allActiveTopics: string[], maxTopics: number): string[] {
  if (allActiveTopics.length <= maxTopics) {
    return allActiveTopics;
  }

  const shuffled = [...allActiveTopics];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    shuffled[i] = shuffled[j] ?? "";
    shuffled[j] = current ?? "";
  }

  return shuffled.slice(0, maxTopics).filter(Boolean);
}

function resolveSerendipityTargetCount(activeInterestCount: number, targetCount: number): number {
  if (targetCount <= 1) {
    return 0;
  }

  const desired =
    activeInterestCount <= 2 ? 5 :
      activeInterestCount <= 4 ? 3 :
        DEFAULT_SERENDIPITY_TARGET_COUNT;

  return Math.min(desired, Math.max(0, targetCount - 1));
}

export async function buildDiscoveryTopics(args: {
  interestMemoryText: string;
  discoveryBrief?: DiscoveryRunInput["discoveryBrief"];
  maxTopics: number;
  targetCount: number;
}): Promise<{
  topics: DiscoveryRunResult["topics"];
  activeTopics: string[];
  serendipityTopics: string[];
  coreTargetCount: number;
  serendipityTargetCount: number;
}> {
  const pools = extractTopicPoolsFromMemory(args.interestMemoryText);
  const activeTopics = pools.activeTopics;

  if (activeTopics.length === 0) {
    const fallbackTopics = deriveTopicsFromMemory({
      interestMemoryText: args.interestMemoryText,
      maxTopics: args.maxTopics
    });
    return {
      topics: fallbackTopics,
      activeTopics: fallbackTopics.map((topic) => topic.topic),
      serendipityTopics: [],
      coreTargetCount: args.targetCount,
      serendipityTargetCount: 0
    };
  }

  const desiredSerendipityTargetCount = resolveSerendipityTargetCount(activeTopics.length, args.targetCount);
  const activeTopicLimit = Math.max(1, Math.min(activeTopics.length, args.maxTopics));
  const selectedActiveTopics = selectActiveTopicsRandomly(activeTopics, activeTopicLimit);
  const serendipityLimit = Math.max(0, args.maxTopics - selectedActiveTopics.length);
  const serendipityTopics = serendipityLimit > 0
    ? await selectSerendipityTopics({
      activeTopics: selectedActiveTopics,
      interestMemoryText: args.interestMemoryText,
      discoveryBrief: args.discoveryBrief,
      maxTopics: Math.min(serendipityLimit, desiredSerendipityTargetCount)
    })
    : [];
  const effectiveSerendipityTargetCount = Math.min(desiredSerendipityTargetCount, serendipityTopics.length);
  const effectiveCoreTargetCount = Math.max(1, args.targetCount - effectiveSerendipityTargetCount);

  return {
    topics: [
      ...selectedActiveTopics.map((topic, index) => ({
        topic,
        query: topic,
        topicRank: index,
        softSuppressed: false
      })),
      ...serendipityTopics.map((topic, index) => ({
        topic,
        query: topic,
        topicRank: activeTopics.length + index,
        softSuppressed: false
      }))
    ],
    activeTopics: selectedActiveTopics,
    serendipityTopics,
    coreTargetCount: effectiveCoreTargetCount,
    serendipityTargetCount: effectiveSerendipityTargetCount
  };
}

export function buildPerTopicQuotas(topics: string[], targetCount: number): Map<string, number> {
  const quotas = new Map<string, number>();
  if (topics.length === 0 || targetCount <= 0) return quotas;

  const base = Math.floor(targetCount / topics.length);
  const remainder = targetCount % topics.length;
  topics.forEach((topic, index) => {
    quotas.set(topic, base + (index < remainder ? 1 : 0));
  });
  return quotas;
}
