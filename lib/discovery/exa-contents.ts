import Exa from "exa-js";

const exaApiKey = process.env.EXA_API_KEY?.trim();
const exaClient = exaApiKey ? new Exa(exaApiKey) : null;

const configuredFinalHighlightMaxCharacters = Number(
  process.env.EXA_FINAL_HIGHLIGHT_MAX_CHARACTERS?.trim() || "4500"
);

export const DEFAULT_EXA_FINAL_HIGHLIGHT_MAX_CHARACTERS =
  Number.isFinite(configuredFinalHighlightMaxCharacters) && configuredFinalHighlightMaxCharacters > 0
    ? Math.floor(configuredFinalHighlightMaxCharacters)
    : 4500;

function canonicalizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = normalizedPath || "/";
    return parsed.toString();
  } catch {
    return value;
  }
}

export async function getFinalHighlightsByUrl(args: {
  urls: string[];
  maxCharacters?: number;
}): Promise<Map<string, string[]>> {
  if (!exaClient) {
    throw new Error("MISSING_EXA_API_KEY");
  }

  const maxCharacters = Math.max(1000, Math.floor(args.maxCharacters ?? DEFAULT_EXA_FINAL_HIGHLIGHT_MAX_CHARACTERS));
  const uniqueUrls = [...new Set(args.urls.map((url) => url.trim()).filter(Boolean))];

  if (uniqueUrls.length === 0) {
    return new Map();
  }

  const response = await exaClient.getContents(uniqueUrls, {
    highlights: { maxCharacters },
    filterEmptyResults: true
  });

  const highlightsByUrl = new Map<string, string[]>();
  for (const result of response.results) {
    const highlights = Array.isArray(result.highlights) ? result.highlights.map((entry) => entry.trim()).filter(Boolean) : [];
    if (highlights.length === 0) continue;
    highlightsByUrl.set(canonicalizeUrl(result.url), highlights);
  }

  return highlightsByUrl;
}
