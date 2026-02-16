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

## Contract Notes
- `DiscoveryCandidate.softSuppressed` carries topic suppression context into final filtering.
- `DiscoveryRunInput` includes tuning knobs for:
  - early-stop buffer (`earlyStopBuffer`)
  - per-domain diversity cap (`maxPerDomain`)
- Caller can keep defaults or override per run.
