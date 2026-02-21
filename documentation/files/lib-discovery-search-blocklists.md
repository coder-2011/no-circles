# File: `lib/discovery/search-blocklists.ts`

## Purpose
Loads remote search blocklist subscriptions and filters discovery candidate URLs against compiled block rules.

## Behavior
1. Defines default subscription URLs (uBlacklist/adblock-style sources) for low-signal, unsafe, content-farm, and AI-spam filtering.
2. Supports runtime override via `DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS` (comma-separated URLs).
3. Fetches subscription files with timeout and fail-open semantics (failed fetches do not break discovery).
4. Parses multiple rule formats:
   - uBlacklist wildcard patterns (for example `*://*.example.com/*`)
   - regex rules (`/.../flags`)
   - adblock-style domain rules (`||domain.tld^`)
   - hosts-file rules (`0.0.0.0 domain.tld`)
   - plain domain entries
5. Caches compiled matchers in-memory with TTL to avoid repeated network and parsing cost.
6. Exposes `filterBlockedSearchResults(results)` for Sonar result filtering.

## Notes
- Filtering is applied in Sonar path after parse/normalize.
- Matching is URL/domain based and intentionally conservative; unparseable lines are ignored.
