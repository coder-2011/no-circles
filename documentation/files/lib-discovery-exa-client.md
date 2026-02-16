# File: `lib/discovery/exa-client.ts`

## Purpose
Thin Exa SDK wrapper for discovery queries.

## Behavior
- Requires `EXA_API_KEY`.
- Calls `exa.search` with:
  - `type: "auto"`
  - `contents.highlights.maxCharacters = 2000`
- Maps SDK results to internal `ExaSearchResult` shape.

## Error Contract
- Throws `MISSING_EXA_API_KEY` when env var is missing.
