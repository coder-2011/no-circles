import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectBestTopicLink } from "@/lib/discovery/haiku-link-selector";

const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalSelectorModel = process.env.ANTHROPIC_LINK_SELECTOR_MODEL;
const originalSummaryModel = process.env.ANTHROPIC_SUMMARY_MODEL;
const originalMemoryModel = process.env.ANTHROPIC_MEMORY_MODEL;

describe("selectBestTopicLink", () => {
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

    if (originalSelectorModel === undefined) {
      delete process.env.ANTHROPIC_LINK_SELECTOR_MODEL;
    } else {
      process.env.ANTHROPIC_LINK_SELECTOR_MODEL = originalSelectorModel;
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

  it("returns zero-based selected index from JSON model output", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL = "claude-3-5-haiku-latest";

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "{\"selected_index\":2,\"rationale\":\"Most concrete first-hand implementation evidence.\"}" }]
      })
    });

    const selected = await selectBestTopicLink({
      topic: "Distributed systems",
      interestMemoryText: "prefers practical incident analyses",
      alreadySelected: [
        { topic: "AI engineering", title: "Production migration lessons from large-scale model serving" }
      ],
      candidates: [
        { url: "https://example.com/one", title: "one", excerpt: "first excerpt" },
        { url: "https://example.com/two", title: "two", excerpt: "second excerpt" }
      ]
    });

    expect(selected).toBe(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      model: string;
      max_tokens: number;
      temperature: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.model).toBe("claude-3-5-haiku-latest");
    expect(requestBody.max_tokens).toBe(120);
    expect(requestBody.temperature).toBe(0);
    expect(requestBody.messages[0]?.content).toContain("Task: choose one best candidate link for the topic.");
    expect(requestBody.messages[0]?.content).toContain(
      "Primary objective: select the candidate with the highest evidence density for the exact topic."
    );
    expect(requestBody.messages[0]?.content).toContain("Output strict JSON only");
    expect(requestBody.messages[0]?.content).toContain("Hard reject rules:");
    expect(requestBody.messages[0]?.content).toContain("Reader-value requirement:");
    expect(requestBody.messages[0]?.content).toContain(
      "reject logistics-first pages (event listings, seminar/workshop pages, schedules, registration/application pages, CFP/job/funding announcements, generic institute/about pages)"
    );
    expect(requestBody.messages[0]?.content).toContain(
      "return NULL unless at least one candidate has both clear topic relevance and at least one concrete teachable unit in excerpt text"
    );
    expect(requestBody.messages[0]?.content).toContain("Do not reward impressive-sounding titles; choose based on excerpt substance.");
    expect(requestBody.messages[0]?.content).toContain("Already selected items in this issue:");
    expect(requestBody.messages[0]?.content).toContain("AI engineering || Production migration lessons from large-scale model serving");
    expect(requestBody.messages[0]?.content).toContain("Tie-break: if two are close, prefer the one that adds a different angle from already selected items.");
  });

  it("returns null when model explicitly returns NULL selector output", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL = "claude-3-5-haiku-latest";

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "{\"selected_index\":\"NULL\",\"rationale\":\"All candidates are generic SEO-style content.\"}" }]
      })
    });

    const selected = await selectBestTopicLink({
      topic: "Distributed systems",
      interestMemoryText: "prefers practical incident analyses",
      candidates: [
        { url: "https://example.com/one", title: "one", excerpt: "first excerpt" },
        { url: "https://example.com/two", title: "two", excerpt: "second excerpt" }
      ]
    });

    expect(selected).toBeNull();
  });

  it("returns null when no candidates are provided", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_LINK_SELECTOR_MODEL = "claude-3-5-haiku-latest";
    const selected = await selectBestTopicLink({
      topic: "x",
      interestMemoryText: "y",
      candidates: []
    });
    expect(selected).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
