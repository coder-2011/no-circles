# File: `lib/discovery/exa-client.ts`

## Purpose
Thin Exa SDK wrapper for discovery queries.

## Behavior
- Requires `EXA_API_KEY`.
- Calls `exa.search` with:
  - `type: "auto"`
  - `contents.highlights.maxCharacters = 4000` by default
  - optional env override: `EXA_DISCOVERY_HIGHLIGHT_MAX_CHARACTERS`
  - `excludeDomains` set by default to a broad low-signal blocklist across:
    - social/UGC (for example `reddit.com`, `x.com`, `youtube.com`, `linkedin.com`)
    - publishing/repost platforms (for example `medium.com`, `substack.com`, `wordpress.com`)
    - marketplaces (`amazon.com`, `ebay.com`, `etsy.com`, `walmart.com`, `target.com`)
    - course/catalog/paywall-heavy sources (`oreilly.com`, `learning.oreilly.com`)
  - optional env extension: `EXA_DISCOVERY_EXCLUDE_DOMAINS` (comma-separated domains)
- Maps SDK results to internal `ExaSearchResult` shape.
- Preserves both `score` (when present) and `highlightScores` for downstream relevance handling.

## Error Contract
- Throws `MISSING_EXA_API_KEY` when env var is missing.
