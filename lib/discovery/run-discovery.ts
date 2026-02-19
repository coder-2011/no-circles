import { deriveTopicsFromMemory } from "@/lib/discovery/topic-derivation";
import { searchDiscovery } from "@/lib/discovery/tavily-client";
import { planQueriesForTopics, shouldUseQueryPlanner } from "@/lib/discovery/query-planner";
import {
  DEFAULT_DISCOVERY_MAX_RETRIES,
  DEFAULT_DISCOVERY_TARGET_COUNT,
  type DiscoveryCandidate,
  type DiscoveryTopic,
  type DiscoveryRunInput,
  type DiscoveryRunResult,
  type DiscoverySearchFn
} from "@/lib/discovery/types";
import {
  applyDomainCap,
  buildAttemptQuery,
  buildDiversityCard,
  dedupeCandidates,
  filterNonSuppressed,
  normalizeCandidate,
  qualityFilterCandidates,
  summarizeQualityFilterDiagnostics,
  selectOnePerTopic,
  shouldEarlyStop
} from "@/lib/discovery/run-discovery-selection";

const DEFAULT_PER_TOPIC_RESULTS = 7;
const DEFAULT_MAX_TOPICS = 10;
const DEFAULT_EARLY_STOP_BUFFER = 2;
const DEFAULT_MAX_PER_DOMAIN = 3;
const DEFAULT_BACKFILL_MAX_TOPIC_SHARE = 0.4;
const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === "1";

function logDiscoveryDebug(event: string, details: Record<string, unknown>) {
  if (!DISCOVERY_DEBUG) return;
  console.info(JSON.stringify({ subsystem: "discovery", event, ...details }));
}

function hasRequiredItemFields(candidate: DiscoveryCandidate): boolean {
  return Boolean(candidate.title && candidate.highlight);
}

function fillFromPool(
  selected: DiscoveryCandidate[],
  pool: DiscoveryCandidate[],
  targetCount: number,
  maxTopicShare?: number
): { items: DiscoveryCandidate[]; added: number } {
  if (selected.length >= targetCount) {
    return { items: selected, added: 0 };
  }

  const selectedUrls = new Set(selected.map((candidate) => candidate.canonicalUrl));
  const topicCounts = new Map<string, number>();
  for (const candidate of selected) {
    topicCounts.set(candidate.topic, (topicCounts.get(candidate.topic) ?? 0) + 1);
  }

  const topicShareCap =
    typeof maxTopicShare === "number" && maxTopicShare > 0 ? Math.max(1, Math.ceil(targetCount * maxTopicShare)) : null;
  let added = 0;

  const orderedPool = [...pool].sort((a, b) => {
    const aCount = topicCounts.get(a.topic) ?? 0;
    const bCount = topicCounts.get(b.topic) ?? 0;
    if (aCount !== bCount) {
      return aCount - bCount;
    }
    if (a.topicRank !== b.topicRank) {
      return a.topicRank - b.topicRank;
    }
    return a.resultRank - b.resultRank;
  });

  for (const candidate of orderedPool) {
    if (selected.length >= targetCount) {
      break;
    }

    if (selectedUrls.has(candidate.canonicalUrl)) {
      continue;
    }

    const topicCount = topicCounts.get(candidate.topic) ?? 0;
    if (topicShareCap !== null && topicCount >= topicShareCap) {
      continue;
    }

    selected.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
    topicCounts.set(candidate.topic, topicCount + 1);
    added += 1;
  }

  return { items: selected, added };
}

export async function runDiscovery(
  input: DiscoveryRunInput,
  deps: {
    exaSearch?: DiscoverySearchFn;
    includeCandidate?: (candidate: DiscoveryCandidate) => boolean;
    queryPlanner?: (args: { interestMemoryText: string; topics: DiscoveryTopic[] }) => Promise<Map<string, string>>;
  } = {}
): Promise<DiscoveryRunResult> {
  const targetCount = input.targetCount ?? DEFAULT_DISCOVERY_TARGET_COUNT;
  const maxRetries = input.maxRetries ?? DEFAULT_DISCOVERY_MAX_RETRIES;
  const maxTopics = input.maxTopics ?? DEFAULT_MAX_TOPICS;
  const basePerTopicResults = input.perTopicResults ?? DEFAULT_PER_TOPIC_RESULTS;
  const earlyStopBuffer = input.earlyStopBuffer ?? DEFAULT_EARLY_STOP_BUFFER;
  const maxPerDomain = input.maxPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
  const exaSearch = deps.exaSearch ?? searchDiscovery;
  const includeCandidate = deps.includeCandidate ?? (() => true);

  const topics = deriveTopicsFromMemory({
    interestMemoryText: input.interestMemoryText,
    maxTopics
  });

  if (topics.length === 0) {
    throw new Error("NO_ACTIVE_TOPICS");
  }

  const warnings: string[] = [];
  const queryPlanner =
    deps.queryPlanner ?? (shouldUseQueryPlanner() ? ({ interestMemoryText, topics }) => planQueriesForTopics({ interestMemoryText, topics }) : null);
  const plannedQueriesByTopic = new Map<string, string>();
  let queryPlannerFallbackError: string | null = null;

  if (queryPlanner) {
    try {
      const planned = await queryPlanner({ interestMemoryText: input.interestMemoryText, topics });
      for (const [topic, query] of planned) {
        plannedQueriesByTopic.set(topic, query);
      }
      if (plannedQueriesByTopic.size > 0) {
        warnings.push(`QUERY_PLANNER_ACTIVE_${plannedQueriesByTopic.size}`);
      }
    } catch (error) {
      queryPlannerFallbackError = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      warnings.push(`QUERY_PLANNER_FALLBACK:${queryPlannerFallbackError}`);
    }
  }

  const aggregateCandidates: DiscoveryCandidate[] = [];
  let candidateFilterExcludedCount = 0;
  let attemptsUsed = 0;
  let earlyStopped = false;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    attemptsUsed = attempt + 1;
    const perTopicResults = basePerTopicResults + attempt * 2;

    for (const topic of topics) {
      const plannedQuery = plannedQueriesByTopic.get(topic.topic);
      const query = buildAttemptQuery(
        {
          ...topic,
          query: plannedQuery && plannedQuery.trim().length > 0 ? plannedQuery : topic.query
        },
        attempt
      );

      try {
        const results = await exaSearch({ query, numResults: perTopicResults });

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
        warnings.push(`DISCOVERY_TOPIC_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
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

    if (earlyStopped) {
      break;
    }
  }

  const deduped = dedupeCandidates(aggregateCandidates);
  const nonSuppressed = filterNonSuppressed(deduped);
  const qualityDiagnostics = summarizeQualityFilterDiagnostics(nonSuppressed);
  const qualityFiltered = qualityFilterCandidates(nonSuppressed, warnings);
  const domainCapped = applyDomainCap(qualityFiltered, Math.max(targetCount * 2, targetCount), maxPerDomain, true);
  const onePerTopic = selectOnePerTopic(domainCapped, targetCount, warnings);
  const selected = [...onePerTopic];
  logDiscoveryDebug("post_filter_stage_counts", {
    deduped_count: deduped.length,
    non_suppressed_count: nonSuppressed.length,
    quality_filtered_count: qualityFiltered.length,
    domain_capped_count: domainCapped.length,
    one_per_topic_count: onePerTopic.length,
    target_count: targetCount,
    quality_pool_diagnostics: qualityDiagnostics,
    warnings
  });

  if (selected.length < targetCount) {
    warnings.push("INSUFFICIENT_TOPIC_WINNERS");
  }

  if (qualityFiltered.length < targetCount) {
    warnings.push("NON_SUPPRESSED_POOL_BELOW_TARGET");
  }

  const nonTopicQualityPool = qualityFiltered.filter(
    (candidate) => !onePerTopic.some((winner) => winner.canonicalUrl === candidate.canonicalUrl)
  );
  const qualityBackfill = fillFromPool(selected, nonTopicQualityPool, targetCount, DEFAULT_BACKFILL_MAX_TOPIC_SHARE);
  if (qualityBackfill.added > 0) {
    warnings.push(`BACKFILLED_FROM_QUALITY_POOL_${qualityBackfill.added}`);
  }

  if (selected.length < targetCount) {
    const relaxedTopicBalanceBackfill = fillFromPool(selected, nonTopicQualityPool, targetCount);
    if (relaxedTopicBalanceBackfill.added > 0) {
      warnings.push(`RELAXED_TOPIC_BALANCE_BACKFILL_${relaxedTopicBalanceBackfill.added}`);
    }
  }

  const relaxedNonSuppressedPool = nonSuppressed
    .filter(hasRequiredItemFields)
    .filter((candidate) => !qualityFiltered.some((qualityCandidate) => qualityCandidate.canonicalUrl === candidate.canonicalUrl));
  const relaxedQualityBackfill = fillFromPool(selected, relaxedNonSuppressedPool, targetCount);
  if (relaxedQualityBackfill.added > 0) {
    warnings.push(`RELAXED_QUALITY_BACKFILL_${relaxedQualityBackfill.added}`);
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

  if (!diversityCard.passes && finalItems.length > 0) {
    warnings.push("DIVERSITY_CARD_FAILED");
  }

  return {
    candidates: finalItems,
    topics,
    attempts: attemptsUsed,
    warnings,
    diversityCard,
    queryPlannerTrace: {
      attempted: Boolean(queryPlanner),
      active: plannedQueriesByTopic.size > 0,
      plannedQueriesByTopic: Object.fromEntries(plannedQueriesByTopic),
      fallbackError: queryPlannerFallbackError
    }
  };
}
