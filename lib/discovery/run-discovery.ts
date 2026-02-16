import { deriveTopicsFromMemory } from "@/lib/discovery/topic-derivation";
import { searchExa } from "@/lib/discovery/exa-client";
import {
  DEFAULT_DISCOVERY_MAX_RETRIES,
  DEFAULT_DISCOVERY_TARGET_COUNT,
  type DiscoveryCandidate,
  type DiscoveryRunInput,
  type DiscoveryRunResult,
  type ExaSearchFn
} from "@/lib/discovery/types";
import {
  applyDomainCap,
  buildAttemptQuery,
  buildDiversityCard,
  dedupeCandidates,
  filterNonSuppressed,
  normalizeCandidate,
  qualityFilterCandidates,
  selectOnePerTopic,
  shouldEarlyStop
} from "@/lib/discovery/run-discovery-selection";

const DEFAULT_PER_TOPIC_RESULTS = 5;
const DEFAULT_MAX_TOPICS = 10;
const DEFAULT_EARLY_STOP_BUFFER = 2;
const DEFAULT_MAX_PER_DOMAIN = 3;

function hasRequiredItemFields(candidate: DiscoveryCandidate): boolean {
  return Boolean(candidate.title && candidate.highlight);
}

function fillFromPool(
  selected: DiscoveryCandidate[],
  pool: DiscoveryCandidate[],
  targetCount: number
): { items: DiscoveryCandidate[]; added: number } {
  if (selected.length >= targetCount) {
    return { items: selected, added: 0 };
  }

  const selectedUrls = new Set(selected.map((candidate) => candidate.canonicalUrl));
  let added = 0;

  for (const candidate of pool) {
    if (selected.length >= targetCount) {
      break;
    }

    if (selectedUrls.has(candidate.canonicalUrl)) {
      continue;
    }

    selected.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
    added += 1;
  }

  return { items: selected, added };
}

export async function runDiscovery(
  input: DiscoveryRunInput,
  deps: { exaSearch?: ExaSearchFn } = {}
): Promise<DiscoveryRunResult> {
  const targetCount = input.targetCount ?? DEFAULT_DISCOVERY_TARGET_COUNT;
  const maxRetries = input.maxRetries ?? DEFAULT_DISCOVERY_MAX_RETRIES;
  const maxTopics = input.maxTopics ?? DEFAULT_MAX_TOPICS;
  const basePerTopicResults = input.perTopicResults ?? DEFAULT_PER_TOPIC_RESULTS;
  const earlyStopBuffer = input.earlyStopBuffer ?? DEFAULT_EARLY_STOP_BUFFER;
  const maxPerDomain = input.maxPerDomain ?? DEFAULT_MAX_PER_DOMAIN;
  const exaSearch = deps.exaSearch ?? searchExa;

  const topics = deriveTopicsFromMemory({
    interestMemoryText: input.interestMemoryText,
    maxTopics
  });

  if (topics.length === 0) {
    throw new Error("NO_ACTIVE_TOPICS");
  }

  const warnings: string[] = [];
  const aggregateCandidates: DiscoveryCandidate[] = [];
  let attemptsUsed = 0;
  let earlyStopped = false;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    attemptsUsed = attempt + 1;
    const perTopicResults = basePerTopicResults + attempt * 2;

    for (const topic of topics) {
      const query = buildAttemptQuery(topic, attempt);

      try {
        const results = await exaSearch({ query, numResults: perTopicResults });

        results.forEach((result, resultIndex) => {
          const normalized = normalizeCandidate({
            topic,
            result,
            resultRank: resultIndex
          });

          if (normalized) {
            aggregateCandidates.push(normalized);
          }
        });
      } catch (error) {
        warnings.push(`EXA_TOPIC_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
      }

      const deduped = dedupeCandidates(aggregateCandidates);
      const nonSuppressed = filterNonSuppressed(deduped);

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
  const qualityFiltered = qualityFilterCandidates(nonSuppressed, warnings);
  const domainCapped = applyDomainCap(qualityFiltered, Math.max(targetCount * 2, targetCount), maxPerDomain, true);
  const onePerTopic = selectOnePerTopic(domainCapped, targetCount, warnings);
  const selected = [...onePerTopic];

  if (selected.length < targetCount) {
    warnings.push("INSUFFICIENT_TOPIC_WINNERS");
  }

  if (qualityFiltered.length < targetCount) {
    warnings.push("NON_SUPPRESSED_POOL_BELOW_TARGET");
  }

  const nonTopicQualityPool = qualityFiltered.filter(
    (candidate) => !onePerTopic.some((winner) => winner.canonicalUrl === candidate.canonicalUrl)
  );
  const qualityBackfill = fillFromPool(selected, nonTopicQualityPool, targetCount);
  if (qualityBackfill.added > 0) {
    warnings.push(`BACKFILLED_FROM_QUALITY_POOL_${qualityBackfill.added}`);
  }

  const relaxedNonSuppressedPool = nonSuppressed
    .filter(hasRequiredItemFields)
    .filter((candidate) => !qualityFiltered.some((qualityCandidate) => qualityCandidate.canonicalUrl === candidate.canonicalUrl));
  const relaxedQualityBackfill = fillFromPool(selected, relaxedNonSuppressedPool, targetCount);
  if (relaxedQualityBackfill.added > 0) {
    warnings.push(`RELAXED_QUALITY_BACKFILL_${relaxedQualityBackfill.added}`);
  }

  if (selected.length < targetCount) {
    throw new Error(`INSUFFICIENT_QUALITY_CANDIDATES:${selected.length}/${targetCount}`);
  }

  const finalItems = selected.slice(0, targetCount);
  const diversityCard = buildDiversityCard(finalItems, targetCount);

  if (!diversityCard.passes && finalItems.length > 0) {
    warnings.push("DIVERSITY_CARD_FAILED");
  }

  return {
    candidates: finalItems,
    topics,
    attempts: attemptsUsed,
    warnings,
    diversityCard
  };
}
