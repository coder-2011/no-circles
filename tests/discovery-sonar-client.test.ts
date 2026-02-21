import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchSonar } from "@/lib/discovery/sonar-client";

const originalPerplexityKey = process.env.PERPLEXITY_API_KEY;
const originalSonarModel = process.env.PERPLEXITY_SONAR_MODEL;
const originalSearchDomainFilter = process.env.PERPLEXITY_SEARCH_DOMAIN_FILTER;
const originalSearchContextSize = process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE;
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

    if (originalSearchDomainFilter === undefined) {
      delete process.env.PERPLEXITY_SEARCH_DOMAIN_FILTER;
    } else {
      process.env.PERPLEXITY_SEARCH_DOMAIN_FILTER = originalSearchDomainFilter;
    }

    if (originalSearchContextSize === undefined) {
      delete process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE;
    } else {
      process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE = originalSearchContextSize;
    }

    if (originalBlocklistSubscriptions === undefined) {
      delete process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS;
    } else {
      process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = originalBlocklistSubscriptions;
    }

    vi.unstubAllGlobals();
  });

  it("prefers search_results metadata urls/titles and ignores invalid entries", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    process.env.PERPLEXITY_SONAR_MODEL = "sonar";
    process.env.PERPLEXITY_SEARCH_DOMAIN_FILTER = "docs.python.org, wikipedia.org";
    process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE = "high";
    process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = "https://example.com/empty-blocklist.txt";

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.perplexity.ai/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            search_results: [
              { title: "Good One", url: "https://example.com/one" },
              { title: "Good Two", url: "https://example.com/two" },
              { title: "Duplicate Url", url: "https://example.com/two" },
              { title: "Bad Url", url: "notaurl" }
            ],
            choices: [
              {
                message: {
                  content: [
                    "[Wrong One] || https://wrong.com/one",
                    "[Wrong Two] || https://wrong.com/two"
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
      search_domain_filter?: string[];
      web_search_options?: { search_context_size?: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.model).toBe("sonar");
    expect(requestBody.temperature).toBe(0.3);
    expect(requestBody.search_domain_filter).toEqual(["docs.python.org", "wikipedia.org"]);
    expect(requestBody.web_search_options?.search_context_size).toBe("high");
    expect(requestBody.messages[0]?.role).toBe("system");
    expect(requestBody.messages[0]?.content).toContain("[TITLE] || https://full-url");
    expect(requestBody.messages[0]?.content).toContain("Style objective:");
    expect(requestBody.messages[0]?.content).toContain("Run entropy token:");
    expect(requestBody.messages[0]?.content).toContain("Creativity lenses for this run");
    const tokenLine = (requestBody.messages[0]?.content ?? "")
      .split("\n")
      .find((line) => line.startsWith("Run entropy token: "));
    expect((tokenLine ?? "").length).toBeGreaterThan(50);
    expect(requestBody.messages[1]?.content).toContain("ACTIVE_INTEREST_TOPIC:");
  });

  it("falls back to citations metadata when search_results is unavailable", async () => {
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
            citations: ["https://citations.example.com/alpha", "https://citations.example.com/beta"]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => ""
      };
    });

    const results = await searchSonar({ query: "systems design", numResults: 10 });
    expect(results).toHaveLength(2);
    expect(results[0]?.url).toBe("https://citations.example.com/alpha");
    expect(results[1]?.url).toBe("https://citations.example.com/beta");
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
            search_results: [
              { title: "Allowed", url: "https://allowed.com/post" },
              { title: "Blocked", url: "https://blocked.example.com/article" }
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

  it("uses medium search context when configured value is invalid", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE = "invalid";
    process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS = "https://example.com/empty-blocklist.txt";

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.perplexity.ai/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            search_results: [{ title: "Allowed", url: "https://allowed.com/post" }]
          })
        };
      }

      return { ok: true, status: 200, text: async () => "" };
    });

    await searchSonar({ query: "systems", numResults: 1 });
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      web_search_options?: { search_context_size?: string };
    };
    expect(requestBody.web_search_options?.search_context_size).toBe("medium");
  });
});
