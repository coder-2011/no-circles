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

export const searchExa: ExaSearchFn = async ({ query, numResults }) => {
  if (!exaClient) {
    throw new Error("MISSING_EXA_API_KEY");
  }

  const response = await exaClient.search(query, {
    type: DEFAULT_EXA_TYPE,
    numResults,
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
    highlights: Array.isArray(result.highlights) ? result.highlights : undefined
  })) satisfies ExaSearchResult[];
};
