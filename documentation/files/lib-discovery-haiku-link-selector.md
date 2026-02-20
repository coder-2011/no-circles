# File: `lib/discovery/haiku-link-selector.ts`

## Purpose
Runs one Anthropic model call per topic to select the best candidate link from Sonar outputs.

## Behavior
1. Requires `ANTHROPIC_API_KEY`.
2. Uses model fallback chain:
   - `ANTHROPIC_LINK_SELECTOR_MODEL`
   - `ANTHROPIC_SUMMARY_MODEL`
   - `ANTHROPIC_MEMORY_MODEL`
3. Sends topic, user memory snippet, and numbered candidate list with short URL excerpt text when available.
4. Enforces integer-only output contract (single index).
5. Parses first integer and returns zero-based selected index or `null`.

## Errors
- `MISSING_ANTHROPIC_API_KEY`
- `MISSING_ANTHROPIC_SELECTOR_MODEL`
- `ANTHROPIC_SELECTOR_HTTP_<status>`
- `INVALID_SELECTOR_RESPONSE`
- `EMPTY_SELECTOR_RESPONSE`
