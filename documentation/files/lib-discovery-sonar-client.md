# File: `lib/discovery/sonar-client.ts`

## Purpose
Implements Perplexity Sonar retrieval for discovery topics with strict, parseable output formatting.

## Behavior
1. Requires `PERPLEXITY_API_KEY`.
2. Calls `https://api.perplexity.ai/chat/completions` with:
   - model: `PERPLEXITY_SONAR_MODEL` (default `sonar`)
   - lower-variance generation temperature (`0.3`) for stability
  - concise retrieval system prompt that prioritizes factual reliability over novelty and forbids fabricated links/titles/incidents/years
   - optional `search_domain_filter` from env `PERPLEXITY_SEARCH_DOMAIN_FILTER` (comma-separated)
   - `web_search_options.search_context_size` from env `PERPLEXITY_SEARCH_CONTEXT_SIZE` (`low|medium|high`, default `medium`)
   - user prompt framed as `ACTIVE_INTEREST_TOPIC:` plus topic query.
3. Parses source metadata first (`search_results`, fallback `citations`) and uses metadata URLs as source-of-truth.
4. Falls back to parsing strict model text line format only when metadata URLs are absent (compatibility path).
5. Applies remote blocklist filtering to parsed results using `lib/discovery/search-blocklists.ts`.
   - default subscriptions include curated uBlacklist/adblock-style sources
   - supports override with `DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS`
   - fail-open on blocklist fetch/parse failures
6. Deduplicates by URL and caps output to requested result count (max 10).
7. Returns results in `ExaSearchResult`-compatible shape for discovery pipeline compatibility.

## Prompt Guardrails
- prefer reliability/factual source quality over novelty
- if uncertain, return fewer candidates
- reject synthetic/sensational pages and logistics-first pages

## Errors
- `MISSING_PERPLEXITY_API_KEY`
- `SONAR_HTTP_<status>`
- `SONAR_INVALID_RESPONSE`
- `SONAR_EMPTY_RESPONSE`
