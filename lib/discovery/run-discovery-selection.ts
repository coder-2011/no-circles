import type { DiscoveryCandidate, DiscoveryDiversityCard, DiscoveryTopic, ExaSearchResult } from "@/lib/discovery/types";

const MIN_ACCEPTABLE_EXA_SCORE = 0.05;
const MIN_TOPIC_SELECTION_SCORE = 0.4;
const EXA_WEIGHT = 0.65;
const HIGHLIGHT_WEIGHT = 0.35;
const TOP_K_HIGHLIGHT_SCORES = 2;

const DIVERSITY_THRESHOLDS = { minDistinctTopics: 6, maxTopicShare: 0.3, minDistinctDomains: 6, maxDomainShare: 0.3 } as const;
const ATTEMPT_POLICIES = [
  { minDistinctDomains: 4, minAvgScore: 0.58, minHighlightCoverage: 0.75 },
  { minDistinctDomains: 4, minAvgScore: 0.55, minHighlightCoverage: 0.7 },
  { minDistinctDomains: 3, minAvgScore: 0.5, minHighlightCoverage: 0.65 }
] as const;
const KNOWN_LOW_SIGNAL_DOMAINS = new Set([
  "goodreads.com", "studylib.net", "itbooks.ir", "barnesandnoble.com", "books.google.com", "bookshop.org", "scribd.com",
  "issuu.com", "coursehero.com", "academia.edu", "pdfdrive.com", "z-lib.org", "papyruspub.com", "faiusr.com"
]);

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

function normalizeHighlightScores(scores: number[] | undefined): number[] {
  if (!Array.isArray(scores)) return [];
  return scores.filter((score): score is number => Number.isFinite(score));
}

function representativeHighlightScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const topK = [...scores].sort((a, b) => b - a).slice(0, TOP_K_HIGHLIGHT_SCORES);
  return topK.reduce((sum, score) => sum + score, 0) / topK.length;
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

function normalizeScore(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (max <= min) return 1;
  return (value - min) / (max - min);
}

function computeTopicSelectionScore(args: {
  exaNorm: number | null;
  highlightNorm: number | null;
}): number {
  let weightedSum = 0;
  let weightSum = 0;

  if (args.exaNorm !== null) {
    weightedSum += args.exaNorm * EXA_WEIGHT;
    weightSum += EXA_WEIGHT;
  }

  if (args.highlightNorm !== null) {
    weightedSum += args.highlightNorm * HIGHLIGHT_WEIGHT;
    weightSum += HIGHLIGHT_WEIGHT;
  }

  if (weightSum === 0) return 0.5;
  return weightedSum / weightSum;
}

function averageScore(candidates: DiscoveryCandidate[]): number {
  const scores = candidates.map((candidate) => candidate.exaScore).filter((score): score is number => score !== null);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function highlightCoverage(candidates: DiscoveryCandidate[]): number {
  if (candidates.length === 0) return 0;
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

function maxShare(counts: Map<string, number>, total: number): number {
  if (total <= 0 || counts.size === 0) return 0;
  return Math.max(...counts.values()) / total;
}

function normalizedEntropy(counts: Map<string, number>, total: number): number {
  if (total <= 0 || counts.size <= 1) return 0;

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / total;
    if (probability > 0) {
      entropy += -probability * Math.log(probability);
    }
  }

  const maxEntropy = Math.log(counts.size);
  if (maxEntropy <= 0) return 0;
  return entropy / maxEntropy;
}

function isLikelyLowSignalCandidate(candidate: DiscoveryCandidate): boolean {
  const domain = candidate.sourceDomain?.toLowerCase() ?? "";
  const normalizedUrl = candidate.url.toLowerCase();

  if (KNOWN_LOW_SIGNAL_DOMAINS.has(domain)) return true;
  if (domain.endsWith(".papyruspub.com") || domain.endsWith(".faiusr.com")) return true;
  return normalizedUrl.endsWith(".pdf") && !domain.endsWith(".edu") && !domain.endsWith(".gov");
}

export function normalizeCandidate(args: {
  topic: DiscoveryTopic;
  result: ExaSearchResult;
  resultRank: number;
}): DiscoveryCandidate | null {
  const canonicalUrl = canonicalizeUrl(args.result.url);
  if (!canonicalUrl) return null;

  const highlights = args.result.highlights?.map((value) => value.trim()).filter(Boolean) ?? [];
  const highlight = highlights[0] ?? null;
  const highlightScores = normalizeHighlightScores(args.result.highlightScores);
  const representativeScore = representativeHighlightScore(highlightScores);

  if (!args.result.title && !highlight) return null;

  return {
    url: args.result.url,
    canonicalUrl,
    title: args.result.title?.trim() || null,
    highlight,
    highlights,
    topic: args.topic.topic,
    topicRank: args.topic.topicRank,
    softSuppressed: args.topic.softSuppressed,
    resultRank: args.resultRank,
    sourceDomain: getDomain(canonicalUrl),
    publishedAt: args.result.publishedDate ?? null,
    exaScore:
      typeof args.result.score === "number"
        ? args.result.score
        : representativeScore !== null
          ? representativeScore
          : null,
    highlightScore: representativeScore,
    highlightScores
  };
}

export function dedupeCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
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

export function filterNonSuppressed(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return candidates.filter((candidate) => !candidate.softSuppressed);
}

export function applyDomainCap(
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

  if (!allowDomainCapRelaxation || selected.length >= targetCount) return selected;

  const selectedUrls = new Set(selected.map((candidate) => candidate.canonicalUrl));
  for (const candidate of candidates) {
    if (selected.length >= targetCount) {
      break;
    }

    if (selectedUrls.has(candidate.canonicalUrl)) continue;

    selected.push(candidate);
    selectedUrls.add(candidate.canonicalUrl);
  }

  return selected;
}

export function qualityFilterCandidates(candidates: DiscoveryCandidate[], warnings: string[]): DiscoveryCandidate[] {
  const filtered: DiscoveryCandidate[] = [];
  let lowSignalDropped = 0;
  let lowScoreDropped = 0;
  let missingFieldsDropped = 0;

  for (const candidate of candidates) {
    if (!candidate.title || !candidate.highlight) {
      missingFieldsDropped += 1;
      continue;
    }

    if (isLikelyLowSignalCandidate(candidate)) {
      lowSignalDropped += 1;
      continue;
    }

    if (candidate.exaScore !== null && candidate.exaScore < MIN_ACCEPTABLE_EXA_SCORE) {
      lowScoreDropped += 1;
      continue;
    }

    filtered.push(candidate);
  }

  if (lowSignalDropped > 0) {
    warnings.push(`LOW_SIGNAL_FILTERED_${lowSignalDropped}`);
  }
  if (lowScoreDropped > 0) {
    warnings.push(`LOW_SCORE_FILTERED_${lowScoreDropped}`);
  }
  if (missingFieldsDropped > 0) {
    warnings.push(`MISSING_FIELDS_FILTERED_${missingFieldsDropped}`);
  }

  return filtered;
}

export function selectOnePerTopic(candidates: DiscoveryCandidate[], targetCount: number, warnings: string[]): DiscoveryCandidate[] {
  const byTopic = new Map<string, DiscoveryCandidate[]>();

  for (const candidate of candidates) {
    const existing = byTopic.get(candidate.topic);
    if (existing) {
      existing.push(candidate);
    } else {
      byTopic.set(candidate.topic, [candidate]);
    }
  }

  const topicOrder = [...byTopic.entries()]
    .map(([topic, topicCandidates]) => ({
      topic,
      topicRank: Math.min(...topicCandidates.map((candidate) => candidate.topicRank))
    }))
    .sort((a, b) => a.topicRank - b.topicRank)
    .map((entry) => entry.topic);

  const winners: DiscoveryCandidate[] = [];
  let belowThresholdCount = 0;

  for (const topic of topicOrder) {
    const topicCandidates = byTopic.get(topic) ?? [];
    if (topicCandidates.length === 0) continue;

    const exaScores = topicCandidates
      .map((candidate) => candidate.exaScore)
      .filter((score): score is number => score !== null);
    const highlightScores = topicCandidates
      .map((candidate) => candidate.highlightScore)
      .filter((score): score is number => score !== null);
    const exaMin = exaScores.length === 0 ? 0 : Math.min(...exaScores);
    const exaMax = exaScores.length === 0 ? 0 : Math.max(...exaScores);
    const highlightMin = highlightScores.length === 0 ? 0 : Math.min(...highlightScores);
    const highlightMax = highlightScores.length === 0 ? 0 : Math.max(...highlightScores);

    const scored = topicCandidates
      .map((candidate) => {
        const exaNorm = normalizeScore(candidate.exaScore, exaMin, exaMax);
        const highlightNorm = normalizeScore(candidate.highlightScore, highlightMin, highlightMax);
        const topicSelectionScore = computeTopicSelectionScore({ exaNorm, highlightNorm });
        return { candidate, topicSelectionScore };
      })
      .sort((a, b) => {
        if (b.topicSelectionScore !== a.topicSelectionScore) {
          return b.topicSelectionScore - a.topicSelectionScore;
        }

        if (a.candidate.resultRank !== b.candidate.resultRank) {
          return a.candidate.resultRank - b.candidate.resultRank;
        }

        return a.candidate.canonicalUrl.localeCompare(b.candidate.canonicalUrl);
      });

    const winner = scored[0];
    if (!winner || winner.topicSelectionScore < MIN_TOPIC_SELECTION_SCORE) {
      belowThresholdCount += 1;
      continue;
    }

    winners.push(winner.candidate);
  }

  if (belowThresholdCount > 0) warnings.push(`LOW_TOPIC_WINNER_SCORE_${belowThresholdCount}`);

  return winners
    .sort((a, b) => a.topicRank - b.topicRank)
    .slice(0, Math.max(1, targetCount));
}

export function buildDiversityCard(candidates: DiscoveryCandidate[], targetCount: number): DiscoveryDiversityCard {
  const topicCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();

  for (const candidate of candidates) {
    topicCounts.set(candidate.topic, (topicCounts.get(candidate.topic) ?? 0) + 1);
    const domain = candidate.sourceDomain ?? "unknown";
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  const itemCount = candidates.length;
  const distinctTopics = topicCounts.size;
  const distinctDomains = domainCounts.size;
  const maxTopicShare = maxShare(topicCounts, itemCount);
  const maxDomainShare = maxShare(domainCounts, itemCount);
  const topicEntropyNormalized = normalizedEntropy(topicCounts, itemCount);

  const passes =
    distinctTopics >= DIVERSITY_THRESHOLDS.minDistinctTopics &&
    maxTopicShare <= DIVERSITY_THRESHOLDS.maxTopicShare &&
    distinctDomains >= DIVERSITY_THRESHOLDS.minDistinctDomains &&
    maxDomainShare <= DIVERSITY_THRESHOLDS.maxDomainShare;

  return {
    itemCount,
    targetCount,
    distinctTopics,
    distinctDomains,
    maxTopicShare,
    maxDomainShare,
    topicEntropyNormalized,
    thresholds: {
      minDistinctTopics: DIVERSITY_THRESHOLDS.minDistinctTopics,
      maxTopicShare: DIVERSITY_THRESHOLDS.maxTopicShare,
      minDistinctDomains: DIVERSITY_THRESHOLDS.minDistinctDomains,
      maxDomainShare: DIVERSITY_THRESHOLDS.maxDomainShare
    },
    passes
  };
}

export function shouldEarlyStop(args: {
  candidates: DiscoveryCandidate[];
  attempt: number;
  targetCount: number;
  earlyStopBuffer: number;
  maxPerDomain: number;
}): boolean {
  const policy = ATTEMPT_POLICIES[Math.min(args.attempt, ATTEMPT_POLICIES.length - 1)];
  const stopTarget = args.targetCount + args.earlyStopBuffer;
  const window = applyDomainCap(args.candidates, stopTarget, args.maxPerDomain, false);

  if (window.length < stopTarget) return false;
  if (distinctDomains(window) < policy.minDistinctDomains) return false;
  if (maxDomainCount(window) > args.maxPerDomain) return false;
  if (highlightCoverage(window) < policy.minHighlightCoverage) return false;
  if (averageScore(window) < policy.minAvgScore) return false;
  return true;
}

export function buildAttemptQuery(topic: DiscoveryTopic, attempt: number): string {
  if (attempt === 0) return topic.query;
  if (attempt === 1) return `${topic.query} practical guide OR deep dive`;
  return `${topic.query} tutorial OR analysis OR explainers`;
}
