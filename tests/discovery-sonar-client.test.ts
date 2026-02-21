import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchSonar } from "@/lib/discovery/sonar-client";

const originalPerplexityKey = process.env.PERPLEXITY_API_KEY;
const originalSonarModel = process.env.PERPLEXITY_SONAR_MODEL;
const originalBlocklistSubscriptions = process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS;

describe("searchSonar", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (originalPerplexityKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = originalPerplexityKey;
    }

    if (originalSonarModel === undefined) {
      delete process.env.PERPLEXITY_SONAR_MODEL;
    } else {
      process.env.PERPLEXITY_SONAR_MODEL = originalSonarModel;
    }

    if (originalBlocklistSubscriptions === undefined) {
      delete process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS;
    } else {
      process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = originalBlocklistSubscriptions;
    }

    vi.unstubAllGlobals();
  });

  it("parses strict title/url line format and ignores invalid lines", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    process.env.PERPLEXITY_SONAR_MODEL = "sonar";
    process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = "https://example.com/empty-blocklist.txt";

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.perplexity.ai/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: [
                    "[Good One] || https://example.com/one",
                    "invalid line",
                    "[Good Two] || https://example.com/two",
                    "[Good Two Duplicate] || https://example.com/two"
                  ].join("\n")
                }
              }
            ]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => ""
      };
    });

    const results = await searchSonar({ query: "distributed systems last 30 days", numResults: 10 });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: "Good One", url: "https://example.com/one" });
    expect(results[1]).toMatchObject({ title: "Good Two", url: "https://example.com/two" });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      model: string;
      temperature: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.model).toBe("sonar");
    expect(requestBody.temperature).toBe(1.3);
    expect(requestBody.messages[0]?.role).toBe("system");
    expect(requestBody.messages[0]?.content).toContain("[TITLE] || https://full-url");
    expect(requestBody.messages[0]?.content).toContain("Topic-memory intent contract:");
    expect(requestBody.messages[0]?.content).toContain("Reader-value contract (strict):");
    expect(requestBody.messages[0]?.content).toContain("Hard rejects (never return):");
    expect(requestBody.messages[0]?.content).toContain(
      "Event pages, seminar/workshop/conference listings, program calendars, registration pages, call-for-papers, job posts, funding announcements, generic institute/about pages, and press-only announcements."
    );
    expect(requestBody.messages[0]?.content).toContain("Temporal relevance contract:");
    expect(requestBody.messages[0]?.content).toContain(
      "Apply recency based on topic volatility, not as a blanket rule."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "If recency materially affects correctness or practical usefulness, treat freshness as a ranking priority."
    );
    expect(requestBody.messages[0]?.content).toContain(
      "For slower-moving domains, freshness is optional but substance is mandatory; prefer durable explainers and research syntheses over event/program pages."
    );
    expect(requestBody.messages[0]?.content).toContain("Run entropy token:");
    expect(requestBody.messages[0]?.content).toContain("Creativity lenses for this run");
    const tokenLine = (requestBody.messages[0]?.content ?? "")
      .split("\n")
      .find((line) => line.startsWith("Run entropy token: "));
    expect((tokenLine ?? "").length).toBeGreaterThan(50);
    expect(requestBody.messages[1]?.content).toContain("ACTIVE_INTEREST_TOPIC:");
  });

  it("filters URLs that match remote blocklist rules", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    process.env.PERPLEXITY_SONAR_MODEL = "sonar";
    process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = "https://example.com/custom-blocklist.txt";

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.perplexity.ai/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: [
                    "[Allowed] || https://allowed.com/post",
                    "[Blocked] || https://blocked.example.com/article"
                  ].join("\n")
                }
              }
            ]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => "*://*.example.com/*"
      };
    });

    const results = await searchSonar({ query: "ai systems", numResults: 10 });
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://allowed.com/post");
  });

  it("throws when api key is missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    await expect(searchSonar({ query: "x", numResults: 3 })).rejects.toThrow("MISSING_PERPLEXITY_API_KEY");
  });
});
