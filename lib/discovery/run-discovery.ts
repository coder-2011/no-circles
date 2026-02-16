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
  let deduped: DiscoveryCandidate[] = [];
  let attemptsUsed = 0;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    attemptsUsed = attempt + 1;
    const perTopicResults = basePerTopicResults + attempt * 2;
    const allCandidates: DiscoveryCandidate[] = [];

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
            allCandidates.push(normalized);
          }
        });
      } catch (error) {
        warnings.push(
          `EXA_TOPIC_FAILURE:${topic.topic}:${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`
        );
      }
    }

    deduped = dedupeCandidates(allCandidates).slice(0, targetCount);

    if (deduped.length >= targetCount) {
      break;
    }
  }

  if (deduped.length < targetCount) {
    warnings.push("INSUFFICIENT_UNIQUE_CANDIDATES");
  }

  return {
    candidates: deduped,
    topics,
    attempts: attemptsUsed,
    warnings
  };
}
