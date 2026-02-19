import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchSonar } from "@/lib/discovery/sonar-client";

const originalPerplexityKey = process.env.PERPLEXITY_API_KEY;
const originalSonarModel = process.env.PERPLEXITY_SONAR_MODEL;

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

    vi.unstubAllGlobals();
  });

  it("parses strict title/url line format and ignores invalid lines", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    process.env.PERPLEXITY_SONAR_MODEL = "sonar";

    fetchMock.mockResolvedValue({
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
    expect(requestBody.messages[0]?.content).toContain("Run entropy token:");
    expect(requestBody.messages[0]?.content).toContain("Creativity lenses for this run");
    const tokenLine = (requestBody.messages[0]?.content ?? "")
      .split("\n")
      .find((line) => line.startsWith("Run entropy token: "));
    expect((tokenLine ?? "").length).toBeGreaterThan(50);
  });

  it("throws when api key is missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    await expect(searchSonar({ query: "x", numResults: 3 })).rejects.toThrow("MISSING_PERPLEXITY_API_KEY");
  });
});
