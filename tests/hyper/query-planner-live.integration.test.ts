import { describe, expect, it } from "vitest";
import { buildQueryPlannerPrompt, planQueriesForTopics } from "@/lib/discovery/query-planner";
import type { DiscoveryTopic } from "@/lib/discovery/types";

const LIVE_FLAG = process.env.RUN_LIVE_QUERY_PLANNER_TESTS === "1";
const HAS_KEY = Boolean(process.env.OPENROUTER_API_KEY?.trim());

const TOPICS: DiscoveryTopic[] = [
  { topic: "Philosophy of physics", query: "Philosophy of physics", topicRank: 0, softSuppressed: false },
  { topic: "Black holes", query: "Black holes", topicRank: 1, softSuppressed: false },
  { topic: "Distributed systems", query: "Distributed systems", topicRank: 2, softSuppressed: false }
];

const MEMORY_TEXT = [
  "PERSONALITY:",
  "- intellectually curious, likes deep arguments and practical tradeoffs",
  "",
  "ACTIVE_INTERESTS:",
  "- Philosophy of physics",
  "- Black holes",
  "- Distributed systems",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- less introductory content, more deep analyses and concrete examples"
].join("\n");

describe("query planner live integration", () => {
  it.skipIf(!LIVE_FLAG || !HAS_KEY)("prints real prompt and planned queries from live model", async () => {
    const prompt = buildQueryPlannerPrompt({
      interestMemoryText: MEMORY_TEXT,
      topics: TOPICS
    });

    const planned = await planQueriesForTopics({
      interestMemoryText: MEMORY_TEXT,
      topics: TOPICS
    });

    const output = TOPICS.map((topic) => ({
      topic: topic.topic,
      query: planned.get(topic.topic) ?? null
    }));

    console.log("\nQUERY_PLANNER_PROMPT_START");
    console.log(prompt);
    console.log("QUERY_PLANNER_PROMPT_END");
    console.log("QUERY_PLANNER_OUTPUT_START");
    console.log(JSON.stringify(output, null, 2));
    console.log("QUERY_PLANNER_OUTPUT_END\n");

    expect(planned.size).toBeGreaterThanOrEqual(2);
    expect(output.some((entry) => entry.query && entry.query.toLowerCase().includes("black holes"))).toBe(true);
  }, 120000);
});
