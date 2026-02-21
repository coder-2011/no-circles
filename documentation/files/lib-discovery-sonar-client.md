# File: `lib/discovery/sonar-client.ts`

## Purpose
Implements Perplexity Sonar retrieval for discovery topics with strict, parseable output formatting.

## Behavior
1. Requires `PERPLEXITY_API_KEY`.
2. Calls `https://api.perplexity.ai/chat/completions` with:
   - model: `PERPLEXITY_SONAR_MODEL` (default `sonar`)
   - system prompt that enforces exact line format: `[TITLE] || https://full-url`
   - system prompt also includes active-interest intent guidance (diverse sub-angles, anti-hype bias, no repetitive single-angle retrieval)
   - system prompt enforces strict reader-value constraints: only substantive pages with transferable insight; hard-rejects logistics/announcement pages (events, schedules, registration/CFP/job/funding/about/press pages)
   - system prompt includes adaptive temporal relevance policy: prioritize freshness for fast-changing topics, but allow older authoritative sources for slower-moving/timeless topics
   - for slower-moving domains, freshness is optional but substance is mandatory
   - user prompt framed as `ACTIVE_INTEREST_TOPIC:` plus topic query.
3. Parses response text line-by-line and keeps only valid format lines.
4. Applies remote blocklist filtering to parsed results using `lib/discovery/search-blocklists.ts`.
   - default subscriptions include curated uBlacklist/adblock-style sources
   - supports override with `DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS`
   - fail-open on blocklist fetch/parse failures
5. Deduplicates by URL and caps output to requested result count (max 10).
6. Returns results in `ExaSearchResult`-compatible shape for discovery pipeline compatibility.

## Errors
- `MISSING_PERPLEXITY_API_KEY`
- `SONAR_HTTP_<status>`
- `SONAR_INVALID_RESPONSE`
- `SONAR_EMPTY_RESPONSE`
