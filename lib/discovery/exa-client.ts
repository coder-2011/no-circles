import { tavily } from "@tavily/core";
import type { ExaSearchFn, ExaSearchResult } from "@/lib/discovery/types";

const tavilyApiKey = process.env.TAVILY_API_KEY?.trim();
const tavilyClient = tavilyApiKey ? tavily({ apiKey: tavilyApiKey }) : null;

const configuredHighlightMaxCharacters = Number(
  process.env.TAVILY_DISCOVERY_CONTENT_MAX_CHARACTERS?.trim() ||
    process.env.EXA_DISCOVERY_HIGHLIGHT_MAX_CHARACTERS?.trim() ||
    "4000"
);

export const DEFAULT_EXA_HIGHLIGHT_MAX_CHARACTERS =
  Number.isFinite(configuredHighlightMaxCharacters) && configuredHighlightMaxCharacters > 0
    ? Math.floor(configuredHighlightMaxCharacters)
    : 4000;
const DEFAULT_TAVILY_SEARCH_DEPTH = (process.env.TAVILY_DISCOVERY_SEARCH_DEPTH?.trim() || "advanced") as
  | "basic"
  | "advanced";

const DEFAULT_EXCLUDED_DOMAINS = [
  // Social / UGC feeds
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "reddit.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "quora.com",
  "pinterest.com",
  "discord.com",
  "discord.gg",
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  // Publishing platforms with frequent low-signal repost/boilerplate
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "wixsite.com",
  // Commerce / retail / marketplaces
  "amazon.com",
  "ebay.com",
  "etsy.com",
  "walmart.com",
  "target.com",
  // Course/catalog/paywall-heavy sources that often return landing pages
  "oreilly.com",
  "learning.oreilly.com"
] as const;

function parseExcludedDomainsEnv(): string[] {
  const raw = process.env.TAVILY_DISCOVERY_EXCLUDE_DOMAINS?.trim() || process.env.EXA_DISCOVERY_EXCLUDE_DOMAINS?.trim();
  if (!raw) {
    return [...DEFAULT_EXCLUDED_DOMAINS];
  }

  const merged = [...DEFAULT_EXCLUDED_DOMAINS, ...raw.split(",").map((entry) => entry.trim().toLowerCase())];
  const deduped = new Set<string>();

  for (const domain of merged) {
    if (!domain) {
      continue;
    }

    deduped.add(domain.replace(/^https?:\/\//, "").replace(/\/+$/, ""));
  }

  return [...deduped];
}

export const EXA_DISCOVERY_EXCLUDED_DOMAINS = parseExcludedDomainsEnv();

function getDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function toHighlights(content: unknown): string[] {
  if (typeof content !== "string") {
    return [];
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  return [normalized.slice(0, DEFAULT_EXA_HIGHLIGHT_MAX_CHARACTERS)];
}

export const searchExa: ExaSearchFn = async ({ query, numResults }) => {
  if (!tavilyClient) {
    throw new Error("MISSING_TAVILY_API_KEY");
  }

  const response = await tavilyClient.search(query, {
    searchDepth: DEFAULT_TAVILY_SEARCH_DEPTH,
    maxResults: numResults
  });

  const filtered = (response.results ?? []).filter((result) => {
    if (!result?.url) return false;
    const domain = getDomain(result.url);
    if (!domain) return false;
    return !EXA_DISCOVERY_EXCLUDED_DOMAINS.some((excluded) => domain === excluded || domain.endsWith(`.${excluded}`));
  });

  return filtered.map((result) => {
    const highlights = toHighlights(result.content);
    return {
      url: result.url,
      title: typeof result.title === "string" ? result.title : null,
      score: typeof result.score === "number" ? result.score : undefined,
      highlights: highlights.length > 0 ? highlights : undefined
    } satisfies ExaSearchResult;
  });
};
