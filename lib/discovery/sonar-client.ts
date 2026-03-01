import type { ExaSearchFn, ExaSearchResult } from "@/lib/discovery/types";
import { filterBlockedSearchResults } from "@/lib/discovery/search-blocklists";

const PERPLEXITY_CHAT_COMPLETIONS_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_SONAR_MODEL = "sonar";
const DEFAULT_SONAR_TEMPERATURE = 1.65;
const MAX_SONAR_RESULTS = 10;
const DEFAULT_SEARCH_CONTEXT_SIZE = "low";

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return normalizeLine(parsed.hostname.replace(/^www\./i, "")) || "Untitled";
  } catch {
    return "Untitled";
  }
}

function stripFence(text: string): string {
  const fencedMatch = text.trim().match(/```(?:text|txt|md|markdown)?\s*([\s\S]*?)\s*```/i);
  return (fencedMatch?.[1] ?? text).trim();
}

function extractTextContent(json: unknown): string {
  if (!json || typeof json !== "object") {
    throw new Error("SONAR_INVALID_RESPONSE");
  }

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("SONAR_INVALID_RESPONSE");
  }

  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("SONAR_EMPTY_RESPONSE");
  }

  return content;
}

function parseSearchResultsFromMetadata(json: unknown, limit: number): ExaSearchResult[] {
  if (!json || typeof json !== "object") {
    throw new Error("SONAR_INVALID_RESPONSE");
  }

  const record = json as {
    search_results?: unknown;
    citations?: unknown;
  };

  const results: ExaSearchResult[] = [];
  const seen = new Set<string>();

  const searchResults = record.search_results;
  if (Array.isArray(searchResults)) {
    for (const item of searchResults) {
      if (results.length >= limit) break;
      if (!item || typeof item !== "object") continue;

      const urlValue = (item as { url?: unknown }).url;
      if (typeof urlValue !== "string") continue;
      const url = urlValue.trim();
      if (!isHttpUrl(url) || seen.has(url)) continue;

      const titleValue = (item as { title?: unknown }).title;
      const title = typeof titleValue === "string" ? normalizeLine(titleValue) : deriveTitleFromUrl(url);
      const safeTitle = title || deriveTitleFromUrl(url);
      seen.add(url);
      results.push({
        title: safeTitle,
        url,
        highlights: [safeTitle]
      });
    }
  }

  if (results.length >= limit) {
    return results;
  }

  const citations = record.citations;
  if (Array.isArray(citations)) {
    for (const citation of citations) {
      if (results.length >= limit) break;
      if (typeof citation !== "string") continue;
      const url = citation.trim();
      if (!isHttpUrl(url) || seen.has(url)) continue;
      const title = deriveTitleFromUrl(url);
      seen.add(url);
      results.push({
        title,
        url,
        highlights: [title]
      });
    }
  }

  return results;
}

function parseSonarResults(text: string, limit: number): ExaSearchResult[] {
  const results: ExaSearchResult[] = [];
  const seen = new Set<string>();
  const lines = stripFence(text).split("\n");

  for (const line of lines) {
    if (results.length >= limit) break;
    const normalized = normalizeLine(line);
    if (!normalized) continue;

    const match = normalized.match(/^\[(.+?)\]\s*\|\|\s*(https?:\/\/\S+)$/i);
    if (!match) continue;

    const title = normalizeLine(match[1] ?? "");
    const url = (match[2] ?? "").trim().replace(/[),.;]+$/, "");
    if (!title || !url) continue;

    const parsed = {
      title,
      url,
      highlights: [title]
    } satisfies ExaSearchResult;

    if (!parsed) continue;
    if (seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    results.push(parsed);
  }

  return results;
}

function buildSystemPrompt(numResults: number): string {
  return [
    "Role: produce parseable candidate lines for one ACTIVE_INTEREST_TOPIC query.",
    "Use only retrieved evidence; do not invent or guess links, titles, sources, incidents, dates, or entities.",
    "If evidence quality is weak or uncertain, return fewer lines (including zero).",
    "Favor exploratory and idea-expanding angles over overly narrow technical incident details unless the query explicitly asks for deep technical specifics.",
    "Prioritize substantive, thought-provoking reads (analysis, synthesis, or well-grounded essays) over commodity explainers.",
    "Hard rejects:",
    "- logistics/admin pages (events, schedules, registration, jobs, funding, CFP, generic about/press pages)",
    "- synthetic/sensational pages or pages without concrete substance",
    "- shallow trend/opinion pages with no clear argument, evidence, or insight",
    "Output contract:",
    `- Return at most ${numResults} lines.`,
    "- One candidate per line only.",
    "- Line format must be exactly: [TITLE] || https://full-url",
    "- Output only these lines. No JSON, bullets, numbering, commentary, or surrounding text."
  ].join("\n");
}

function parseSearchDomainFilter(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const domains = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return domains.length > 0 ? domains : undefined;
}

function resolveSearchContextSize(): "low" | "medium" | "high" {
  const value = (process.env.PERPLEXITY_SEARCH_CONTEXT_SIZE?.trim().toLowerCase() ?? DEFAULT_SEARCH_CONTEXT_SIZE) as
    | "low"
    | "medium"
    | "high";
  return value === "medium" || value === "high" ? value : "low";
}

export const searchSonar: ExaSearchFn = async ({ query, numResults }) => {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  const modelName = process.env.PERPLEXITY_SONAR_MODEL?.trim() || DEFAULT_SONAR_MODEL;
  const searchDomainFilter = parseSearchDomainFilter(process.env.PERPLEXITY_SEARCH_DOMAIN_FILTER);
  const searchContextSize = resolveSearchContextSize();
  if (!apiKey) {
    throw new Error("MISSING_PERPLEXITY_API_KEY");
  }

  const requestedResults = Math.max(1, Math.min(MAX_SONAR_RESULTS, Math.floor(numResults)));
  const response = await fetch(PERPLEXITY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature: DEFAULT_SONAR_TEMPERATURE,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(requestedResults)
        },
        {
          role: "user",
          content: ["ACTIVE_INTEREST_TOPIC:", query].join("\n")
        }
      ],
      search_domain_filter: searchDomainFilter,
      web_search_options: {
        search_context_size: searchContextSize
      }
    })
  });

  if (!response.ok) {
    throw new Error(`SONAR_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const parsedFromMetadata = parseSearchResultsFromMetadata(json, requestedResults);
  const parsed = parsedFromMetadata.length > 0 ? parsedFromMetadata : parseSonarResults(extractTextContent(json), requestedResults);
  return filterBlockedSearchResults(parsed);
};
