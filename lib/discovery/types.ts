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
  topic: string;
  topicRank: number;
  softSuppressed: boolean;
  resultRank: number;
  sourceDomain: string | null;
  publishedAt: string | null;
  exaScore: number | null;
};

export type DiscoveryRunInput = {
  interestMemoryText: string;
  targetCount?: number;
  maxRetries?: number;
  maxTopics?: number;
  perTopicResults?: number;
  earlyStopBuffer?: number;
  maxPerDomain?: number;
};

export type DiscoveryRunResult = {
  candidates: DiscoveryCandidate[];
  topics: DiscoveryTopic[];
  attempts: number;
  warnings: string[];
};

export type ExaSearchResult = {
  url: string;
  title: string | null;
  publishedDate?: string;
  score?: number;
  highlights?: string[];
};

export type ExaSearchFn = (args: {
  query: string;
  numResults: number;
}) => Promise<ExaSearchResult[]>;
