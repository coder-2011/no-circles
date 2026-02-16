# File: `lib/discovery/types.ts`

## Purpose
Declares shared contracts and defaults for discovery pipeline stage (PR6).

## Key Exports
- `DEFAULT_DISCOVERY_TARGET_COUNT` (default `10`)
- `DEFAULT_DISCOVERY_MAX_RETRIES` (default `3`)
- `DiscoveryTopic`
- `DiscoveryCandidate`
- `DiscoveryRunInput`
- `DiscoveryRunResult`
- `ExaSearchResult`
- `ExaSearchFn`

## Why It Exists
Keeps PR6 interfaces explicit and stable so PR7 extraction can consume discovery output without contract drift.
