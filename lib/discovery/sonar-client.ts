import type { ExaSearchFn, ExaSearchResult } from "@/lib/discovery/types";
import { createHash, randomBytes } from "node:crypto";
import { filterBlockedSearchResults } from "@/lib/discovery/search-blocklists";

const PERPLEXITY_CHAT_COMPLETIONS_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_SONAR_MODEL = "sonar";
const MAX_SONAR_RESULTS = 10;
const DEFAULT_SEARCH_CONTEXT_SIZE = "medium";
const CREATIVE_LENSE_POOL = [
  "counterfactual failure modes",
  "unexpected tradeoff reversals",
  "rare edge-case postmortems",
  "cross-domain analogy with operational evidence",
  "non-obvious implementation constraints",
  "high-leverage architecture inflection points",
  "benchmark disagreement analysis",
  "production incident lessons with concrete remediation"
] as const;
const KEYWORD_STYLE_POOL = [
  "short, dense noun phrases",
  "named methods/protocols/standards",
  "failure and recovery vocabulary",
  "evaluation and benchmarking terms",
  "migration and rollout terminology",
  "systems-performance terminology",
  "operator-style filters and qualifiers",
  "specific artifact-type markers"
] as const;
const QUERY_OPERATOR_POOL = [
  "postmortem",
  "\"case study\"",
  "\"failure mode\"",
  "\"trade-off\"",
  "\"lessons learned\"",
  "\"production\"",
  "benchmark",
  "incident",
  "migration",
  "\"design doc\""
] as const;

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

function sampleWithoutReplacement<T>(values: readonly T[], count: number): T[] {
  const pool = [...values];
  const picked: T[] = [];
  const target = Math.max(0, Math.min(count, pool.length));

  for (let index = 0; index < target; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(randomIndex, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
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
  const thematicSeed = Math.floor(Math.random() * 1000000).toString();
  const runEntropyToken = randomBytes(48).toString("hex");
  const themedEntropyToken = createHash("sha256").update(`${thematicSeed}:${runEntropyToken}`).digest("hex");
  const runLensList = sampleWithoutReplacement(CREATIVE_LENSE_POOL, 4).map((value) => `- ${value}`).join("\n");
  const runStyleList = sampleWithoutReplacement(KEYWORD_STYLE_POOL, 3).map((value) => `- ${value}`).join("\n");
  const runOperatorList = sampleWithoutReplacement(QUERY_OPERATOR_POOL, 3).map((value) => `- ${value}`).join("\n");

  return [
    "Return concise candidate lines for one active-interest topic query.",
    "Style objective: practical, evidence-heavy, and non-repetitive candidates.",
    "Do not invent links or sources. If search evidence is weak, return fewer lines.",
    "Formatting rules:",
    `- Return exactly ${numResults} lines when possible.`,
    "- One candidate per line.",
    "- Output format per line must be exactly: [TITLE] || https://full-url",
    "- Output only lines in this format. No JSON, bullets, numbering, commentary, or extra text.",
    "- Use run entropy token and directives as hidden variation guidance; never print tokens.",
    "- Use thematic seed as hidden guidance for tone/rhythm only; never print the seed.",
    "",
    `Run entropy token: ${runEntropyToken}`,
    `Themed entropy token: ${themedEntropyToken}`,
    `Thematic seed: ${thematicSeed}`,
    "Creativity lenses for this run (use at least two):",
    runLensList,
    "",
    "Keyword style directives for this run:",
    runStyleList,
    "",
    "High-signal operator hints to bias retrieval choices:",
    runOperatorList
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
  return value === "low" || value === "high" ? value : "medium";
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
      temperature: 0.3,
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
