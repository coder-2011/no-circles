import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planQueriesForTopics, shouldUseQueryPlanner } from "@/lib/discovery/query-planner";
import type { DiscoveryTopic } from "@/lib/discovery/types";

const TOPICS: DiscoveryTopic[] = [
  { topic: "AI engineering", query: "AI engineering", topicRank: 0, softSuppressed: false },
  { topic: "Distributed systems", query: "Distributed systems", topicRank: 1, softSuppressed: false }
];

const MEMORY_TEXT = [
  "PERSONALITY:",
  "- practical",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- Distributed systems",
  "",
  "SUPPRESSED_INTERESTS:",
  "-",
  "",
  "RECENT_FEEDBACK:",
  "- less hype"
].join("\n");

const originalOpenrouterKey = process.env.OPENROUTER_API_KEY;
const originalPlannerFlag = process.env.DISCOVERY_QUERY_PLANNER_ENABLED;
const originalPlannerModel = process.env.OPENROUTER_QUERY_PLANNER_MODEL;

describe("query-planner", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (originalOpenrouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenrouterKey;
    }

    if (originalPlannerFlag === undefined) {
      delete process.env.DISCOVERY_QUERY_PLANNER_ENABLED;
    } else {
      process.env.DISCOVERY_QUERY_PLANNER_ENABLED = originalPlannerFlag;
    }

    if (originalPlannerModel === undefined) {
      delete process.env.OPENROUTER_QUERY_PLANNER_MODEL;
    } else {
      process.env.OPENROUTER_QUERY_PLANNER_MODEL = originalPlannerModel;
    }

    vi.unstubAllGlobals();
  });

  it("enables planner only when key exists and flag is not disabled", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DISCOVERY_QUERY_PLANNER_ENABLED;
    expect(shouldUseQueryPlanner()).toBe(false);

    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.DISCOVERY_QUERY_PLANNER_ENABLED;
    expect(shouldUseQueryPlanner()).toBe(true);

    process.env.DISCOVERY_QUERY_PLANNER_ENABLED = "0";
    expect(shouldUseQueryPlanner()).toBe(false);

    process.env.DISCOVERY_QUERY_PLANNER_ENABLED = "1";
    expect(shouldUseQueryPlanner()).toBe(true);
  });

  it("returns only matching requested topics and normalizes planned queries", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.OPENROUTER_QUERY_PLANNER_MODEL;

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                "```json",
                JSON.stringify({
                  plans: [
                    {
                      topic: "  AI engineering  ",
                      query:
                        "  AI engineering postmortem reliability benchmark -tutorial -beginner -beginners -introduction -basics -101  "
                    },
                    {
                      topic: "Unknown topic",
                      query: "this should be ignored"
                    },
                    {
                      topic: "AI engineering",
                      query: "duplicate for same topic should be ignored"
                    },
                    {
                      topic: "Distributed systems",
                      query: `${"x".repeat(260)}`
                    }
                  ]
                }),
                "```"
              ].join("\n")
            }
          }
        ]
      })
    });

    const planned = await planQueriesForTopics({
      interestMemoryText: MEMORY_TEXT,
      topics: TOPICS
    });

    expect(planned.size).toBe(2);
    expect(planned.get("AI engineering")).toBe(
      "AI engineering postmortem reliability benchmark -tutorial -beginner -beginners -introduction -basics -101"
    );
    expect((planned.get("Distributed systems") ?? "").length).toBeLessThanOrEqual(220);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      model: string;
      temperature: number;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.model).toBe("qwen/qwen3-14b");
    expect(requestBody.temperature).toBe(0);
    expect(requestBody.max_tokens).toBe(450);
    expect(requestBody.messages[0]?.content).toContain("Optional cross-interest extension is allowed");
    expect(requestBody.messages[0]?.content).toContain("do not force connections when weak");
  });

  it("throws http errors from OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500
    });

    await expect(
      planQueriesForTopics({
        interestMemoryText: MEMORY_TEXT,
        topics: TOPICS
      })
    ).rejects.toThrow("QUERY_PLANNER_HTTP_500");
  });

  it("throws on invalid model payload shape", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] })
    });

    await expect(
      planQueriesForTopics({
        interestMemoryText: MEMORY_TEXT,
        topics: TOPICS
      })
    ).rejects.toThrow("QUERY_PLANNER_INVALID_RESPONSE");
  });
});
