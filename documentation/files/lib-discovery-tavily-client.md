# File: `lib/discovery/tavily-client.ts`

## Purpose
Thin discovery-provider SDK wrapper (now Tavily-backed) for retrieval queries.

## Behavior
- Requires `TAVILY_API_KEY`.
- Calls `tavily.search` with:
  - `searchDepth` (default `advanced`, override via `TAVILY_DISCOVERY_SEARCH_DEPTH`)
  - `maxResults` from discovery `numResults`
- Uses a shared low-signal excluded-domain list with optional env extension:
  - `TAVILY_DISCOVERY_EXCLUDE_DOMAINS`
- Tavily `content` is normalized and capped before mapping into internal `highlights` (single-item array):
  - `TAVILY_DISCOVERY_CONTENT_MAX_CHARACTERS` (default `4000`)
- Maps provider results to internal `DiscoverySearchResult` shape used by discovery orchestration.

## Error Contract
- Throws `MISSING_TAVILY_API_KEY` when env var is missing.
