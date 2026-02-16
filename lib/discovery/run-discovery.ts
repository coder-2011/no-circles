import { deriveTopicsFromMemory } from "@/lib/discovery/topic-derivation";
import { searchExa } from "@/lib/discovery/exa-client";
import {
  DEFAULT_DISCOVERY_MAX_RETRIES,
  DEFAULT_DISCOVERY_TARGET_COUNT,
  type DiscoveryCandidate,
  type DiscoveryRunInput,
  type DiscoveryRunResult,
  type DiscoveryTopic,
  type ExaSearchFn,
  type ExaSearchResult
} from "@/lib/discovery/types";

const DEFAULT_PER_TOPIC_RESULTS = 5;
const DEFAULT_MAX_TOPICS = 10;
const DEFAULT_EARLY_STOP_BUFFER = 2;
const DEFAULT_MAX_PER_DOMAIN = 3;

const ATTEMPT_POLICIES = [
  { minDistinctDomains: 4, minAvgScore: 0.58, minHighlightCoverage: 0.75 },
  { minDistinctDomains: 4, minAvgScore: 0.55, minHighlightCoverage: 0.7 },
  { minDistinctDomains: 3, minAvgScore: 0.5, minHighlightCoverage: 0.65 }
] as const;

function canonicalizeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return null;
    }

    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = normalizedPath || "/";

    return parsed.toString();
  } catch {
    return null;
  }
}

function getDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCandidate(args: {
  topic: DiscoveryTopic;
  result: ExaSearchResult;
  resultRank: number;
}): DiscoveryCandidate | null {
  const canonicalUrl = canonicalizeUrl(args.result.url);
  if (!canonicalUrl) {
    return null;
  }

  const highlight = args.result.highlights?.map((value) => value.trim()).find(Boolean) ?? null;

  if (!args.result.title && !highlight) {
    return null;
  }

  return {
    url: args.result.url,
    canonicalUrl,
    title: args.result.title?.trim() || null,
    highlight,
    topic: args.topic.topic,
    topicRank: args.topic.topicRank,
    softSuppressed: args.topic.softSuppressed,
    resultRank: args.resultRank,
    sourceDomain: getDomain(canonicalUrl),
    publishedAt: args.result.publishedDate ?? null,
    exaScore: typeof args.result.score === "number" ? args.result.score : null
  };
}

function keepPreferred(existing: DiscoveryCandidate, incoming: DiscoveryCandidate): DiscoveryCandidate {
  if (incoming.topicRank !== existing.topicRank) {
    return incoming.topicRank < existing.topicRank ? incoming : existing;
  }

  if (incoming.resultRank !== existing.resultRank) {
    return incoming.resultRank < existing.resultRank ? incoming : existing;
  }

  if (incoming.exaScore !== null && existing.exaScore !== null && incoming.exaScore !== existing.exaScore) {
    return incoming.exaScore > existing.exaScore ? incoming : existing;
  }

  return existing;
}

function dedupeCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const deduped = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    const existing = deduped.get(candidate.canonicalUrl);
    if (!existing) {
      deduped.set(candidate.canonicalUrl, candidate);
      continue;
    }

    deduped.set(candidate.canonicalUrl, keepPreferred(existing, candidate));
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.topicRank !== b.topicRank) {
      return a.topicRank - b.topicRank;
    }

    if (a.resultRank !== b.resultRank) {
      return a.resultRank - b.resultRank;
    }

    return a.canonicalUrl.localeCompare(b.canonicalUrl);
  });
}

function filterNonSuppressed(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return candidates.filter((candidate) => !candidate.softSuppressed);
}

function applyDomainCap(
  candidates: DiscoveryCandidate[],
  targetCount: number,
  maxPerDomain: number,
  allowDomainCapRelaxation: boolean
): DiscoveryCandidate[] {
  const selected: DiscoveryCandidate[] = [];
  const domainCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= targetCount) {
      break;
    }

    const domain = candidate.sourceDomain ?? "unknown";
    const currentCount = domainCounts.get(domain) ?? 0;

    if (currentCount >= maxPerDomain) {
      continue;
    }

    selected.push(candidate);
    domainCounts.set(domain, currentCount + 1);
  }

  if (!allowDomainCapRelaxation || selected.length >= targetCount) {
    return selected;
  }

  const selectedUrls = new Set(selected.map((candidate) => candidate.canonicalUrl));
  for (const candidate of candidates) {
    if (selected.length >= targetCount) {
      break;
    }

    if (selectedUrls.has(candidate.canonicalUrl)) {
      continue;
    }

    selected.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
  }

  return selected;
}

function averageScore(candidates: DiscoveryCandidate[]): number {
  const scores = candidates.map((candidate) => candidate.exaScore).filter((score): score is number => score !== null);
  if (scores.length === 0) {
    return 0;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function highlightCoverage(candidates: DiscoveryCandidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  const countWithHighlight = candidates.filter((candidate) => Boolean(candidate.highlight)).length;
  return countWithHighlight / candidates.length;
}

function distinctDomains(candidates: DiscoveryCandidate[]): number {
  return new Set(candidates.map((candidate) => candidate.sourceDomain ?? "unknown")).size;
}

function maxDomainCount(candidates: DiscoveryCandidate[]): number {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const domain = candidate.sourceDomain ?? "unknown";
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  return Math.max(0, ...counts.values());
}

function shouldEarlyStop(args: {
  candidates: DiscoveryCandidate[];
  attempt: number;
  targetCount: number;
  earlyStopBuffer: number;
  maxPerDomain: number;
}): boolean {
  const policy = ATTEMPT_POLICIES[Math.min(args.attempt, ATTEMPT_POLICIES.length - 1)];
  const stopTarget = args.targetCount + args.earlyStopBuffer;
  const window = applyDomainCap(args.candidates, stopTarget, args.maxPerDomain, false);

  if (window.length < stopTarget) {
    return false;
  }

  if (distinctDomains(window) < policy.minDistinctDomains) {
    return false;
  }

  if (maxDomainCount(window) > args.maxPerDomain) {
    return false;
  }

  if (highlightCoverage(window) < policy.minHighlightCoverage) {
    return false;
  }

  if (averageScore(window) < policy.minAvgScore) {
    return false;
  }

  return true;
}

function buildAttemptQuery(topic: DiscoveryTopic, attempt: number): string {
  if (attempt === 0) {
    return topic.query;
  }

  if (attempt === 1) {
    return `${topic.query} practical guide OR deep dive`;
  }

  return `${topic.query} tutorial OR analysis OR explainers`;
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
    return {
      candidates: [],
      topics,
      attempts: 1,
      warnings: ["NO_ACTIVE_TOPICS"]
    };
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
        warnings.push(
          `EXA_TOPIC_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`
        );
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
  const capped = applyDomainCap(nonSuppressed, targetCount, maxPerDomain, true);

  if (capped.length < targetCount) {
    warnings.push("INSUFFICIENT_UNIQUE_CANDIDATES");
  }

  if (nonSuppressed.length < targetCount) {
    warnings.push("NON_SUPPRESSED_POOL_BELOW_TARGET");
  }

  return {
    candidates: capped,
    topics,
    attempts: attemptsUsed,
    warnings
  };
}
