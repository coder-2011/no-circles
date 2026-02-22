export const DEFAULT_DISCOVERY_TARGET_COUNT = 10;
export const DEFAULT_DISCOVERY_MAX_RETRIES = 3;

export type DiscoveryTopic = {
  topic: string;
  query: string;
  topicRank: number;
  softSuppressed: boolean;
};

export type DiscoveryCandidate = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  highlight: string | null;
  highlights: string[];
  topic: string;
  topicRank: number;
  softSuppressed: boolean;
  resultRank: number;
  sourceDomain: string | null;
  publishedAt: string | null;
  exaScore: number | null;
  highlightScore: number | null;
  highlightScores: number[];
};

export type DiscoveryDiversityCard = {
  itemCount: number;
  targetCount: number;
  distinctTopics: number;
  distinctDomains: number;
  maxTopicShare: number;
  maxDomainShare: number;
  topicEntropyNormalized: number;
  thresholds: {
    minDistinctTopics: number;
    maxTopicShare: number;
    minDistinctDomains: number;
    maxDomainShare: number;
  };
  passes: boolean;
};

export type DiscoveryRunInput = {
  interestMemoryText: string;
  targetCount?: number;
  maxRetries?: number;
  maxTopics?: number;
  perTopicResults?: number;
  earlyStopBuffer?: number;
  maxPerDomain?: number;
  requireUrlExcerpt?: boolean;
};

export type DiscoveryRunResult = {
  candidates: DiscoveryCandidate[];
  topics: DiscoveryTopic[];
  serendipityTopics?: string[];
  attempts: number;
  warnings: string[];
  diversityCard: DiscoveryDiversityCard;
};

export type ExaSearchResult = {
  url: string;
  title: string | null;
  publishedDate?: string;
  score?: number;
  highlights?: string[];
  highlightScores?: number[];
  excerpt?: string;
};

export type ExaSearchFn = (args: {
  query: string;
  numResults: number;
}) => Promise<ExaSearchResult[]>;
