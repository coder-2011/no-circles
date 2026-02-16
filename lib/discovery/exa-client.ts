import Exa from "exa-js";
import type { ExaSearchFn, ExaSearchResult } from "@/lib/discovery/types";

const exaApiKey = process.env.EXA_API_KEY?.trim();
const exaClient = exaApiKey ? new Exa(exaApiKey) : null;

export const DEFAULT_EXA_TYPE = "auto" as const;
const configuredHighlightMaxCharacters = Number(
  process.env.EXA_DISCOVERY_HIGHLIGHT_MAX_CHARACTERS?.trim() || "4000"
);

export const DEFAULT_EXA_HIGHLIGHT_MAX_CHARACTERS =
  Number.isFinite(configuredHighlightMaxCharacters) && configuredHighlightMaxCharacters > 0
    ? Math.floor(configuredHighlightMaxCharacters)
    : 4000;

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
  const raw = process.env.EXA_DISCOVERY_EXCLUDE_DOMAINS?.trim();
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

export const searchExa: ExaSearchFn = async ({ query, numResults }) => {
  if (!exaClient) {
    throw new Error("MISSING_EXA_API_KEY");
  }

  const response = await exaClient.search(query, {
    type: DEFAULT_EXA_TYPE,
    numResults,
    excludeDomains: EXA_DISCOVERY_EXCLUDED_DOMAINS,
    contents: {
      highlights: {
        maxCharacters: DEFAULT_EXA_HIGHLIGHT_MAX_CHARACTERS
      }
    }
  });

  return response.results.map((result) => ({
    url: result.url,
    title: result.title,
    publishedDate: result.publishedDate,
    score: result.score,
    highlights: Array.isArray(result.highlights) ? result.highlights : undefined,
    highlightScores: Array.isArray(result.highlightScores) ? result.highlightScores : undefined
  })) satisfies ExaSearchResult[];
};
