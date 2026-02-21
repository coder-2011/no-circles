# File: `lib/discovery/sonar-client.ts`

## Purpose
Implements Perplexity Sonar retrieval for discovery topics with strict, parseable output formatting.

## Behavior
1. Requires `PERPLEXITY_API_KEY`.
2. Calls `https://api.perplexity.ai/chat/completions` with:
   - model: `PERPLEXITY_SONAR_MODEL` (default `sonar`)
   - system prompt that enforces exact line format: `[TITLE] || https://full-url`
   - system prompt also includes active-interest intent guidance (diverse sub-angles, anti-hype bias, no repetitive single-angle retrieval)
   - user prompt framed as `ACTIVE_INTEREST_TOPIC:` plus topic query.
3. Parses response text line-by-line and keeps only valid format lines.
4. Deduplicates by URL and caps output to requested result count (max 10).
5. Returns results in `ExaSearchResult`-compatible shape for discovery pipeline compatibility.

## Errors
- `MISSING_PERPLEXITY_API_KEY`
- `SONAR_HTTP_<status>`
- `SONAR_INVALID_RESPONSE`
- `SONAR_EMPTY_RESPONSE`
