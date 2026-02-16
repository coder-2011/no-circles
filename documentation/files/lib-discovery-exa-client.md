# File: `lib/discovery/exa-client.ts`

## Purpose
Thin Exa SDK wrapper for discovery queries.

## Behavior
- Requires `EXA_API_KEY`.
- Calls `exa.search` with:
  - `type: "auto"`
  - `contents.highlights.maxCharacters = 4000` by default
  - optional env override: `EXA_DISCOVERY_HIGHLIGHT_MAX_CHARACTERS`
- Maps SDK results to internal `ExaSearchResult` shape.

## Error Contract
- Throws `MISSING_EXA_API_KEY` when env var is missing.
