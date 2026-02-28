import { deriveTopicsFromMemory, extractTopicPoolsFromMemory } from "@/lib/discovery/topic-derivation";
import { selectBestTopicLink } from "@/lib/discovery/haiku-link-selector";
import { selectSerendipityTopics } from "@/lib/discovery/haiku-serendipity-selector";
import { buildHaikuQuery } from "@/lib/discovery/haiku-query-builder";
import { searchSonar } from "@/lib/discovery/sonar-client";
import { fetchUrlExcerpt } from "@/lib/discovery/url-excerpt";
import { logInfo } from "@/lib/observability/log";
import {
  DEFAULT_DISCOVERY_MAX_RETRIES,
  DEFAULT_DISCOVERY_TARGET_COUNT,
  type DiscoveryCandidate,
  type DiscoveryRunInput,
  type DiscoveryRunResult,
  type ExaSearchFn,
  type ExaSearchResult
} from "@/lib/discovery/types";
export type { DiscoveryRunResult } from "@/lib/discovery/types";
import {
  buildDiversityCard,
  dedupeCandidates,
  filterNonSuppressed,
  normalizeCandidate,
  qualityFilterCandidates,
  summarizeQualityFilterDiagnostics,
  shouldEarlyStop
} from "@/lib/discovery/run-discovery-selection";

const DEFAULT_PER_TOPIC_RESULTS = 7;
const DEFAULT_MAX_TOPICS = 10;
const DEFAULT_EARLY_STOP_BUFFER = 2;
const DEFAULT_MAX_PER_DOMAIN = 3;
const DEFAULT_SERENDIPITY_TARGET_COUNT = 2;
const RECENCY_OPERATORS = ["last 7 days", "last 30 days", "last 90 days", "last 12 months", "since previous year"] as const;
const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === "1";
const LOW_SIGNAL_EXCERPT_PATTERNS = [
  /post not found/i,
  /page not found/i,
  /doesn['’]t exist or has been moved/i,
  /about press copyright contact us creators advertise developers terms privacy policy/i,
  /jump to content/i,
  /toggle navigation/i,
  /all rights reserved/i
] as const;
const LOW_SIGNAL_EXCERPT_NAV_TERMS = [
  "sign in",
  "sign up",
  "privacy policy",
  "terms",
  "copyright",
  "menu",
  "subscribe",
  "contact us"
] as const;

function logDiscoveryDebug(event: string, details: Record<string, unknown>) {
  if (!DISCOVERY_DEBUG) return;
  logInfo("discovery", event, details);
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLowSignalExcerpt(excerpt: string): boolean {
  const normalized = normalizeLine(excerpt).toLowerCase();
  if (!normalized) return true;

  if (LOW_SIGNAL_EXCERPT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  let navSignals = 0;
  for (const token of LOW_SIGNAL_EXCERPT_NAV_TERMS) {
    if (normalized.includes(token)) {
      navSignals += 1;
    }
  }

  return navSignals >= 5;
}

function hasRecencyOperator(query: string): boolean {
  const lower = query.toLowerCase();
  return RECENCY_OPERATORS.some((operator) => lower.includes(operator));
}

function appendRecencyOperator(query: string, topicRank: number, attempt: number): string {
  const normalized = normalizeLine(query);
  if (!normalized) return normalized;
  if (hasRecencyOperator(normalized)) return normalized;

  const operator = RECENCY_OPERATORS[(topicRank + attempt) % RECENCY_OPERATORS.length] ?? RECENCY_OPERATORS[0];
  return `${normalized} ${operator}`;
}

function reorderBySelectedIndex<T>(items: T[], selectedIndex: number | null): T[] {
  if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= items.length) {
    return items;
  }
  if (selectedIndex === 0) return items;
  const selected = items[selectedIndex];
  return [selected, ...items.slice(0, selectedIndex), ...items.slice(selectedIndex + 1)];
}

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

async function buildDiscoveryTopics(args: {
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

  // Preserve legacy fallback when ACTIVE_INTERESTS is empty.
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
  const serendipityTargetCount = desiredSerendipityTargetCount;
  const serendipityLimit = Math.max(0, args.maxTopics - selectedActiveTopics.length);
  const serendipityTopics = serendipityLimit > 0
    ? await selectSerendipityTopics({
      activeTopics: selectedActiveTopics,
      interestMemoryText: args.interestMemoryText,
      discoveryBrief: args.discoveryBrief,
      maxTopics: Math.min(serendipityLimit, serendipityTargetCount)
    })
    : [];
  const effectiveSerendipityTargetCount = Math.min(serendipityTargetCount, serendipityTopics.length);
  const effectiveCoreTargetCount = Math.max(1, args.targetCount - effectiveSerendipityTargetCount);

  const topics = [
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
  ];

  return {
    topics,
    activeTopics: selectedActiveTopics,
    serendipityTopics,
    coreTargetCount: effectiveCoreTargetCount,
    serendipityTargetCount: effectiveSerendipityTargetCount
  };
}

function buildPerTopicQuotas(topics: string[], targetCount: number): Map<string, number> {
  const quotas = new Map<string, number>();
  if (topics.length === 0 || targetCount <= 0) return quotas;

  const base = Math.floor(targetCount / topics.length);
  const remainder = targetCount % topics.length;
  topics.forEach((topic, index) => {
    quotas.set(topic, base + (index < remainder ? 1 : 0));
  });
  return quotas;
}

function sortCandidatesForSelection(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.topicRank !== b.topicRank) return a.topicRank - b.topicRank;
    if (a.resultRank !== b.resultRank) return a.resultRank - b.resultRank;
    return a.canonicalUrl.localeCompare(b.canonicalUrl);
  });
}

function selectByTopicQuotas(args: {
  candidates: DiscoveryCandidate[];
  topicQuotas: Map<string, number>;
}): DiscoveryCandidate[] {
  const selected: DiscoveryCandidate[] = [];
  const selectedUrls = new Set<string>();
  const perTopicCount = new Map<string, number>();

  const ordered = sortCandidatesForSelection(args.candidates);

  for (const candidate of ordered) {
    const quota = args.topicQuotas.get(candidate.topic) ?? 0;
    if (quota <= 0) continue;
    if (selectedUrls.has(candidate.canonicalUrl)) continue;

    const current = perTopicCount.get(candidate.topic) ?? 0;
    if (current >= quota) continue;

    selected.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
    perTopicCount.set(candidate.topic, current + 1);
  }

  return selected;
}

function backfillFromQualityPool(args: {
  selected: DiscoveryCandidate[];
  qualityPool: DiscoveryCandidate[];
  targetCount: number;
}): DiscoveryCandidate[] {
  if (args.selected.length >= args.targetCount) {
    return args.selected;
  }

  const selectedUrls = new Set(args.selected.map((candidate) => candidate.canonicalUrl));
  const filled = [...args.selected];

  for (const candidate of sortCandidatesForSelection(args.qualityPool)) {
    if (filled.length >= args.targetCount) {
      break;
    }
    if (selectedUrls.has(candidate.canonicalUrl)) {
      continue;
    }

    filled.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
  }

  return filled;
}

export async function runDiscovery(
  input: DiscoveryRunInput,
  deps: {
    exaSearch?: ExaSearchFn;
    includeCandidate?: (candidate: DiscoveryCandidate) => boolean;
    linkSelector?: (args: {
      topic: string;
      interestMemoryText: string;
      discoveryBrief?: DiscoveryRunInput["discoveryBrief"];
      candidates: Array<{ url: string; title: string | null; highlights?: string[]; excerpt?: string }>;
      alreadySelected: Array<{ topic: string; title: string }>;
    }) => Promise<number | null>;
    excerptExtractor?: (args: { url: string; maxCharacters: number }) => Promise<string | null>;
    queryBuilder?: (args: {
      topic: string;
      interestMemoryText: string;
      discoveryBrief?: DiscoveryRunInput["discoveryBrief"];
      attempt: number;
    }) => Promise<string>;
  } = {}
): Promise<DiscoveryRunResult> {
  const targetCount = input.targetCount ?? DEFAULT_DISCOVERY_TARGET_COUNT;
  const maxAttempts = input.maxAttempts ?? input.maxRetries ?? DEFAULT_DISCOVERY_MAX_RETRIES;
  const maxTopics = input.maxTopics ?? DEFAULT_MAX_TOPICS;
  const basePerTopicResults = input.perTopicResults ?? DEFAULT_PER_TOPIC_RESULTS;
  const earlyStopBuffer = input.earlyStopBuffer ?? DEFAULT_EARLY_STOP_BUFFER;
  const maxPerDomain = input.maxPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
  const exaSearch = deps.exaSearch ?? searchSonar;
  const includeCandidate = deps.includeCandidate ?? (() => true);
  const linkSelector = deps.linkSelector ?? selectBestTopicLink;
  const excerptExtractor = deps.excerptExtractor ?? fetchUrlExcerpt;
  const queryBuilder = deps.queryBuilder ?? buildHaikuQuery;

  const topicPlan = await buildDiscoveryTopics({
    interestMemoryText: input.interestMemoryText,
    discoveryBrief: input.discoveryBrief,
    maxTopics,
    targetCount
  });
  const topics = topicPlan.topics;
  const coreTopicQuotas = buildPerTopicQuotas(topicPlan.activeTopics, topicPlan.coreTargetCount);
  const serendipityTopicQuotas = buildPerTopicQuotas(topicPlan.serendipityTopics, topicPlan.serendipityTargetCount);

  if (topics.length === 0) {
    throw new Error("NO_ACTIVE_TOPICS");
  }

  const warnings: string[] = [];

  const aggregateCandidates: DiscoveryCandidate[] = [];
  let candidateFilterExcludedCount = 0;
  let attemptsUsed = 0;
  let earlyStopped = false;
  const alreadySelected: Array<{ topic: string; title: string }> = [];
  const pendingTopicRanks = new Set(topics.map((topic) => topic.topicRank));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const topicsThisAttempt = topics.filter((topic) => pendingTopicRanks.has(topic.topicRank));
    if (topicsThisAttempt.length === 0) {
      break;
    }

    attemptsUsed = attempt + 1;
    const perTopicResults = basePerTopicResults + attempt * 2;
    const satisfiedTopicRanks = new Set<number>();

    for (const topic of topicsThisAttempt) {
      let baseQuery = topic.topic;
      let querySource: "haiku" | "fallback" = "fallback";

      try {
        const generatedQuery = await queryBuilder({
          topic: topic.topic,
          interestMemoryText: input.interestMemoryText,
          discoveryBrief: input.discoveryBrief,
          attempt: attempt + 1
        });
        const normalizedGenerated = normalizeLine(generatedQuery);
        if (!normalizedGenerated) {
          throw new Error("EMPTY_GENERATED_QUERY");
        }
        baseQuery = normalizedGenerated;
        querySource = "haiku";
      } catch (error) {
        warnings.push(
          `QUERY_BUILDER_FALLBACK:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_QUERY_BUILDER_ERROR"}`
        );
      }

      const query = appendRecencyOperator(baseQuery, topic.topicRank, attempt);
      logDiscoveryDebug("topic_query_built", {
        topic: topic.topic,
        attempt: attempt + 1,
        query_source: querySource,
        query
      });

      try {
        const rawResults = await exaSearch({ query, numResults: perTopicResults });
        let selectorCandidates: ExaSearchResult[] = rawResults;

        if (input.requireUrlExcerpt) {
          const extracted: ExaSearchResult[] = [];
          for (const rawResult of rawResults) {
            const excerpt = await excerptExtractor({
              url: rawResult.url,
              maxCharacters: 1500
            });

            if (!excerpt) {
              warnings.push(`CANDIDATE_EXTRACTION_FAILED:${topic.topic}:${rawResult.url}`);
              continue;
            }
            if (isLowSignalExcerpt(excerpt)) {
              warnings.push(`CANDIDATE_LOW_SIGNAL_EXCERPT:${topic.topic}:${rawResult.url}`);
              continue;
            }

            extracted.push({
              ...rawResult,
              excerpt,
              highlights: [excerpt]
            });
          }

          selectorCandidates = extracted;
        }

        if (selectorCandidates.length === 0) {
          warnings.push(`TOPIC_NO_EXTRACTED_CANDIDATES:${topic.topic}`);
          continue;
        }

        const selectorEligibleCandidates = selectorCandidates.filter((result, resultIndex) => {
          const normalized = normalizeCandidate({
            topic,
            result,
            resultRank: resultIndex
          });

          if (!normalized) return false;
          if (includeCandidate(normalized)) return true;

          candidateFilterExcludedCount += 1;
          return false;
        });

        if (selectorEligibleCandidates.length === 0) {
          warnings.push(`TOPIC_NO_SELECTOR_ELIGIBLE_CANDIDATES:${topic.topic}`);
          continue;
        }

        satisfiedTopicRanks.add(topic.topicRank);

        let results = selectorEligibleCandidates;
        if (selectorEligibleCandidates.length > 1) {
          try {
            const selectedIndex = await linkSelector({
              topic: topic.topic,
              interestMemoryText: input.interestMemoryText,
              discoveryBrief: input.discoveryBrief,
              candidates: selectorEligibleCandidates,
              alreadySelected: alreadySelected.map((item) => ({ ...item }))
            });
            results = reorderBySelectedIndex(selectorEligibleCandidates, selectedIndex);
          } catch (error) {
            warnings.push(`TOPIC_SELECTOR_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
          }
        }

        const selectedTitle = results[0]?.title?.trim();
        if (selectedTitle) {
          alreadySelected.push({ topic: topic.topic, title: selectedTitle });
        }

        results.forEach((result, resultIndex) => {
          const normalized = normalizeCandidate({
            topic,
            result,
            resultRank: resultIndex
          });

          if (normalized) {
            if (includeCandidate(normalized)) {
              aggregateCandidates.push(normalized);
            } else {
              candidateFilterExcludedCount += 1;
            }
          }
        });
      } catch (error) {
        warnings.push(`EXA_TOPIC_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
      }

      const deduped = dedupeCandidates(aggregateCandidates);
      const nonSuppressed = filterNonSuppressed(deduped);
      const diagnostics = summarizeQualityFilterDiagnostics(nonSuppressed);
      logDiscoveryDebug("attempt_topic_progress", {
        attempt: attempt + 1,
        topic: topic.topic,
        aggregate_count: aggregateCandidates.length,
        deduped_count: deduped.length,
        non_suppressed_count: nonSuppressed.length,
        quality_pool_preview: diagnostics
      });

      if (
        shouldEarlyStop({
          candidates: nonSuppressed,
          attempt,
          targetCount,
          earlyStopBuffer,
          maxPerDomain
        })
      ) {
        warnings.push(`EARLY_STOP_TRIGGERED_ATTEMPT_${attempt + 1}`);
        earlyStopped = true;
        break;
      }
    }

    for (const topicRank of satisfiedTopicRanks) {
      pendingTopicRanks.delete(topicRank);
    }

    if (earlyStopped) {
      break;
    }
  }

  const deduped = dedupeCandidates(aggregateCandidates);
  const nonSuppressed = filterNonSuppressed(deduped);
  const qualityDiagnostics = summarizeQualityFilterDiagnostics(nonSuppressed);
  const qualityFiltered = qualityFilterCandidates(nonSuppressed, warnings);
  const activeTopicSet = new Set(topicPlan.activeTopics);
  const serendipityTopicSet = new Set(topicPlan.serendipityTopics);
  const corePool = qualityFiltered.filter((candidate) => activeTopicSet.has(candidate.topic));
  const serendipityPool = qualityFiltered.filter((candidate) => serendipityTopicSet.has(candidate.topic));
  const selectedCore = selectByTopicQuotas({
    candidates: corePool,
    topicQuotas: coreTopicQuotas
  });
  const selectedSerendipity = selectByTopicQuotas({
    candidates: serendipityPool,
    topicQuotas: serendipityTopicQuotas
  });
  const selectedBeforeBackfill = [...selectedCore, ...selectedSerendipity];
  const selected = backfillFromQualityPool({
    selected: selectedBeforeBackfill,
    qualityPool: qualityFiltered,
    targetCount
  });
  logDiscoveryDebug("post_filter_stage_counts", {
    deduped_count: deduped.length,
    non_suppressed_count: nonSuppressed.length,
    quality_filtered_count: qualityFiltered.length,
    core_pool_count: corePool.length,
    serendipity_pool_count: serendipityPool.length,
    selected_core_count: selectedCore.length,
    selected_serendipity_count: selectedSerendipity.length,
    target_count: targetCount,
    core_target_count: topicPlan.coreTargetCount,
    serendipity_target_count: topicPlan.serendipityTargetCount,
    quality_pool_diagnostics: qualityDiagnostics,
    warnings
  });

  if (selected.length > selectedBeforeBackfill.length) {
    warnings.push(`BACKFILLED_FROM_QUALITY_POOL_${selected.length - selectedBeforeBackfill.length}`);
  }

  if (selectedCore.length < topicPlan.coreTargetCount) {
    warnings.push(`INSUFFICIENT_CORE_TOPIC_ALLOCATION:${selectedCore.length}/${topicPlan.coreTargetCount}`);
  }

  if (selectedSerendipity.length < topicPlan.serendipityTargetCount) {
    warnings.push(`INSUFFICIENT_SERENDIPITY_ALLOCATION:${selectedSerendipity.length}/${topicPlan.serendipityTargetCount}`);
  }

  if (selected.length < targetCount) {
    logDiscoveryDebug("insufficient_quality_candidates", {
      selected_count: selected.length,
      target_count: targetCount,
      deduped_count: deduped.length,
      non_suppressed_count: nonSuppressed.length,
      quality_filtered_count: qualityFiltered.length,
      quality_pool_diagnostics: qualityDiagnostics,
      warnings
    });
    throw new Error(`INSUFFICIENT_QUALITY_CANDIDATES:${selected.length}/${targetCount}`);
  }

  const finalItems = selected.slice(0, targetCount);
  const diversityCard = buildDiversityCard(finalItems, targetCount);

  if (candidateFilterExcludedCount > 0) {
    warnings.push(`CANDIDATE_FILTERED_${candidateFilterExcludedCount}`);
  }

  return {
    candidates: finalItems,
    topics,
    serendipityTopics: [...topicPlan.serendipityTopics],
    attempts: attemptsUsed,
    warnings,
    diversityCard
  };
}
