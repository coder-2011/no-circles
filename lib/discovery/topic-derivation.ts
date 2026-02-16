import { parseSections } from "@/lib/memory/contract";
import type { DiscoveryTopic } from "@/lib/discovery/types";

const DEFAULT_MAX_TOPICS = 10;

function cleanLine(line: string): string {
  return line.replace(/^[-*\d.)\s]+/, "").trim();
}

function parseBulletLines(section: string): string[] {
  const seen = new Map<string, string>();

  for (const raw of section.split("\n")) {
    const cleaned = cleanLine(raw);
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

function softSuppressed(topic: string, suppressedLines: string[]): boolean {
  const normalizedTopic = topic.toLowerCase();
  return suppressedLines.some((entry) => {
    const normalizedEntry = entry.toLowerCase();
    return normalizedEntry.includes(normalizedTopic) || normalizedTopic.includes(normalizedEntry);
  });
}

function buildContextSnippet(personalityLines: string[], feedbackLines: string[]): string {
  const context = [...personalityLines.slice(0, 2), ...feedbackLines.slice(0, 2)]
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .join("; ")
    .trim();

  if (!context) {
    return "";
  }

  return ` (${context})`;
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
  const contextSnippet = buildContextSnippet(personalityLines, feedbackLines);

  const topics = topicBase.map((topic, originalIndex) => ({
    topic,
    query: `${topic}${contextSnippet}`,
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
