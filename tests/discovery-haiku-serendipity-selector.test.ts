import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectSerendipityTopics } from "@/lib/discovery/haiku-serendipity-selector";

const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalSerendipityModel = process.env.ANTHROPIC_SERENDIPITY_MODEL;
const originalLinkSelectorModel = process.env.ANTHROPIC_LINK_SELECTOR_MODEL;
const originalSummaryModel = process.env.ANTHROPIC_SUMMARY_MODEL;
const originalMemoryModel = process.env.ANTHROPIC_MEMORY_MODEL;

describe("selectSerendipityTopics", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (originalAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    }

    if (originalSerendipityModel === undefined) {
      delete process.env.ANTHROPIC_SERENDIPITY_MODEL;
    } else {
      process.env.ANTHROPIC_SERENDIPITY_MODEL = originalSerendipityModel;
    }

    if (originalLinkSelectorModel === undefined) {
      delete process.env.ANTHROPIC_LINK_SELECTOR_MODEL;
    } else {
      process.env.ANTHROPIC_LINK_SELECTOR_MODEL = originalLinkSelectorModel;
    }

    if (originalSummaryModel === undefined) {
      delete process.env.ANTHROPIC_SUMMARY_MODEL;
    } else {
      process.env.ANTHROPIC_SUMMARY_MODEL = originalSummaryModel;
    }

    if (originalMemoryModel === undefined) {
      delete process.env.ANTHROPIC_MEMORY_MODEL;
    } else {
      process.env.ANTHROPIC_MEMORY_MODEL = originalMemoryModel;
    }

    vi.unstubAllGlobals();
  });

  it("uses explicit active topics as authority and strips ACTIVE_INTERESTS from memory context", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_SERENDIPITY_MODEL = "claude-3-5-haiku-latest";

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "{\"topics\":[\"causal inference\",\"market design\"]}" }]
      })
    });

    const selected = await selectSerendipityTopics({
      activeTopics: ["distributed systems", "economics"],
      interestMemoryText: [
        "PERSONALITY:",
        "- prefers first-principles reasoning",
        "",
        "ACTIVE_INTERESTS:",
        "- distributed systems",
        "- economics",
        "",
        "RECENT_FEEDBACK:",
        "- more institutional analysis"
      ].join("\n"),
      maxTopics: 2
    });

    expect(selected).toEqual(["causal inference", "market design"]);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };

    expect(requestBody.system).toContain("senior cross-domain editor");
    expect(requestBody.messages[0]?.content).toContain(
      "Use the explicit Active interests list as the primary source for what the reader actively wants coverage on today."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "Use PERSONALITY to infer learning style, abstraction level, and what kinds of adjacent topics will feel naturally interesting rather than random."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "Use RECENT_FEEDBACK to expand toward recently reinforced directions and avoid adjacent areas that would repeat a downweighted theme."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "Do not infer active topics from the memory context block below; the active-topic authority is the explicit Active interests list."
    );
    expect(requestBody.messages[0]?.content).toContain("Active interests:");
    expect(requestBody.messages[0]?.content).toContain("1. distributed systems");
    expect(requestBody.messages[0]?.content).toContain("2. economics");
    expect(requestBody.messages[0]?.content).toContain("PERSONALITY:");
    expect(requestBody.messages[0]?.content).toContain("- prefers first-principles reasoning");
    expect(requestBody.messages[0]?.content).toContain("RECENT_FEEDBACK:");
    expect(requestBody.messages[0]?.content).toContain("- more institutional analysis");
    expect(requestBody.messages[0]?.content).not.toContain("ACTIVE_INTERESTS:");
  });
});
