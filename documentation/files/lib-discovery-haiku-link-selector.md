# File: `lib/discovery/haiku-link-selector.ts`

## Purpose
Runs one Anthropic model call per topic to select the best candidate link from Sonar outputs.

## Behavior
1. Requires `ANTHROPIC_API_KEY`.
2. Uses model fallback chain:
   - `ANTHROPIC_LINK_SELECTOR_MODEL`
   - `ANTHROPIC_SUMMARY_MODEL`
   - `ANTHROPIC_MEMORY_MODEL`
3. Sends topic, user memory snippet, optional `discoveryBrief`, progressive issue context (`alreadySelected` as topic/title pairs from prior topic selections), and numbered candidate list with short URL excerpt text when available.
4. Uses a role-oriented Anthropic system prompt (`senior research curator`) and a concise user-prompt contract: prioritize exact topic fit + evidence density (mechanisms, named systems, quantitative outcomes, incident details, reproducible steps), apply hard rejects for low-signal SEO-like and logistics-first pages, then abstain with `NULL` if nothing passes quality bar.
5. Selector prompt enforces reader-value gate: prefer candidates with transferable mechanisms/findings/tradeoffs from excerpt text (not keyword density).
6. Selector prompt treats recency as a soft preference (reject stale only when explicitly time-bound as current/upcoming), explicitly avoids title-only bias, prioritizes clearer concrete evidence over broad trend framing, prefers primary/first-hand sources when quality is comparable, and chooses lower-hype higher-specificity options when uncertain.
7. When `discoveryBrief` is present, the prompt may avoid repeated patterns and prefer the current editorial angle for the day.
8. Expects strict JSON output: `{"selected_index": <1-based integer or "NULL">}`.
9. Parses JSON output first and retains integer-text fallback parsing for compatibility.
10. Returns zero-based selected index or `null`.

## Errors
- `MISSING_ANTHROPIC_API_KEY`
- `MISSING_ANTHROPIC_SELECTOR_MODEL`
- `ANTHROPIC_SELECTOR_HTTP_<status>`
- `INVALID_SELECTOR_RESPONSE`
- `EMPTY_SELECTOR_RESPONSE`
