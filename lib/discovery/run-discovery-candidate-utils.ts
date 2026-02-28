import type { DiscoveryCandidate, DiscoveryTopic, ExaSearchResult } from "@/lib/discovery/types";

const EXA_WEIGHT = 0.65;
const HIGHLIGHT_WEIGHT = 0.35;
const TOP_K_HIGHLIGHT_SCORES = 2;

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

export function normalizeScore(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (max <= min) return 1;
  return (value - min) / (max - min);
}

export function computeTopicSelectionScore(args: {
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
