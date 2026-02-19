# File: `lib/discovery/exa-client.ts`

## Purpose
Thin discovery-provider SDK wrapper (now Tavily-backed) for retrieval queries.

## Behavior
- Requires `TAVILY_API_KEY`.
- Calls `tavily.search` with:
  - `searchDepth` (default `advanced`, override via `TAVILY_DISCOVERY_SEARCH_DEPTH`)
  - `maxResults` from discovery `numResults`
- Uses a shared low-signal excluded-domain list with optional env extension:
  - `TAVILY_DISCOVERY_EXCLUDE_DOMAINS` (fallback supports `EXA_DISCOVERY_EXCLUDE_DOMAINS`)
- Tavily returns full-page `content`; client maps this into internal `highlights` by truncating content to configured max characters:
  - `TAVILY_DISCOVERY_CONTENT_MAX_CHARACTERS` (fallback supports `EXA_DISCOVERY_HIGHLIGHT_MAX_CHARACTERS`)
- Maps provider results to internal `ExaSearchResult` shape to preserve discovery pipeline compatibility.

## Error Contract
- Throws `MISSING_TAVILY_API_KEY` when env var is missing.
