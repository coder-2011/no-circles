import { parseSections } from "@/lib/memory/contract";
import type { DiscoveryTopic } from "@/lib/discovery/types";

const DEFAULT_MAX_TOPICS = 10;

function cleanLine(line: string): string {
  return line.replace(/^[-*\d.)\s]+/, "").trim();
}

function splitCompoundTopicLine(line: string): string[] {
  const cleaned = cleanLine(line);
  if (!cleaned || cleaned === "-") {
    return [];
  }

  const normalized = cleaned.replace(/\s{2,}/g, " ").trim();
  const dashSegments = normalized.split(/\s-\s/).map((segment) => segment.trim()).filter(Boolean);
  const primarySegments = dashSegments.length > 1 ? dashSegments : [normalized];
  const finalSegments = primarySegments
    .flatMap((segment) => segment.split(/\s*,\s*/))
    .map((segment) => segment.trim())
    .filter(Boolean);

  return finalSegments.length > 0 ? finalSegments : [normalized];
}

function parseBulletLines(section: string): string[] {
  const seen = new Map<string, string>();

  for (const raw of section.split("\n")) {
    const topics = splitCompoundTopicLine(raw);
    for (const topic of topics) {
      const key = topic.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, topic);
      }
    }
  }

  return [...seen.values()];
}

function softSuppressed(topic: string, suppressedLines: string[]): boolean {
  const normalizedTopic = topic.toLowerCase();
  return suppressedLines.some((entry) => {
    const normalizedEntry = entry.toLowerCase();
    return normalizedEntry.includes(normalizedTopic) || normalizedTopic.includes(normalizedEntry);
  });
}

function deriveSeedTopics(personalityLines: string[], feedbackLines: string[]): string[] {
  const seedLines = [...feedbackLines, ...personalityLines];
  const seen = new Map<string, string>();

  for (const line of seedLines) {
    const cleaned = cleanLine(line);
    if (!cleaned || cleaned === "-") {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, cleaned);
    }
  }

  return [...seen.values()];
}

export function extractTopicPoolsFromMemory(interestMemoryText: string): {
  activeTopics: string[];
  suppressedTopics: string[];
  serendipitySeedTopics: string[];
} {
  const sections = parseSections(interestMemoryText);
  if (!sections) {
    return {
      activeTopics: [],
      suppressedTopics: [],
      serendipitySeedTopics: []
    };
  }

  const activeTopics = parseBulletLines(sections.ACTIVE_INTERESTS);
  const suppressedTopics = parseBulletLines(sections.SUPPRESSED_INTERESTS);
  const personalityLines = parseBulletLines(sections.PERSONALITY);
  const feedbackLines = parseBulletLines(sections.RECENT_FEEDBACK);
  const seedTopics = deriveSeedTopics(personalityLines, feedbackLines);

  const activeKeys = new Set(activeTopics.map((topic) => topic.toLowerCase()));
  const suppressedKeys = new Set(suppressedTopics.map((topic) => topic.toLowerCase()));

  const serendipitySeedTopics = seedTopics.filter((topic) => {
    const key = topic.toLowerCase();
    return !activeKeys.has(key) && !suppressedKeys.has(key);
  });

  return {
    activeTopics,
    suppressedTopics,
    serendipitySeedTopics
  };
}

export function deriveTopicsFromMemory(args: {
  interestMemoryText: string;
  maxTopics?: number;
}): DiscoveryTopic[] {
  const sections = parseSections(args.interestMemoryText);
  if (!sections) {
    return [];
  }

  const activeLines = parseBulletLines(sections.ACTIVE_INTERESTS);
  const personalityLines = parseBulletLines(sections.PERSONALITY);
  const feedbackLines = parseBulletLines(sections.RECENT_FEEDBACK);
  const fallbackSeedTopics = deriveSeedTopics(personalityLines, feedbackLines);
  const topicBase = activeLines.length > 0 ? activeLines : fallbackSeedTopics;

  if (topicBase.length === 0) {
    return [];
  }

  const suppressedLines = parseBulletLines(sections.SUPPRESSED_INTERESTS);

  const topics = topicBase.map((topic, originalIndex) => ({
    topic,
    query: topic,
    topicRank: originalIndex,
    softSuppressed: softSuppressed(topic, suppressedLines)
  }));

  const maxTopics = args.maxTopics ?? DEFAULT_MAX_TOPICS;

  return topics
    .sort((a, b) => {
      if (a.softSuppressed !== b.softSuppressed) {
        return a.softSuppressed ? 1 : -1;
      }

      return a.topicRank - b.topicRank;
    })
    .slice(0, Math.max(1, maxTopics))
    .map((topic, index) => ({ ...topic, topicRank: index }));
}
