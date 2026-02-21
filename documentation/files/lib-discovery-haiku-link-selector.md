# File: `lib/discovery/haiku-link-selector.ts`

## Purpose
Runs one Anthropic model call per topic to select the best candidate link from Sonar outputs.

## Behavior
1. Requires `ANTHROPIC_API_KEY`.
2. Uses model fallback chain:
   - `ANTHROPIC_LINK_SELECTOR_MODEL`
   - `ANTHROPIC_SUMMARY_MODEL`
   - `ANTHROPIC_MEMORY_MODEL`
3. Sends topic, user memory snippet, progressive issue context (`alreadySelected` as topic/title pairs from prior topic selections), and numbered candidate list with short URL excerpt text when available.
4. Selector prompt uses a concise contract: prioritize topic fit + evidence quality, apply hard rejects for low-signal SEO-like and logistics-first pages, then abstain with `NULL` if nothing passes quality bar.
5. Selector prompt enforces reader-value gate: prefer candidates with transferable mechanisms/findings/tradeoffs from excerpt text (not keyword density).
6. Selector prompt applies a lightweight diversity tie-break only when two candidates are similarly strong.
7. Expects strict JSON output: `{"selected_index": <1-based integer or "NULL">, "rationale": "<short text>"}`.
8. Parses JSON output first and retains integer-text fallback parsing for compatibility.
9. Returns zero-based selected index or `null`.

## Errors
- `MISSING_ANTHROPIC_API_KEY`
- `MISSING_ANTHROPIC_SELECTOR_MODEL`
- `ANTHROPIC_SELECTOR_HTTP_<status>`
- `INVALID_SELECTOR_RESPONSE`
- `EMPTY_SELECTOR_RESPONSE`
