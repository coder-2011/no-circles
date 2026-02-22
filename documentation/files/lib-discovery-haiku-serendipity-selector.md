# File: `lib/discovery/haiku-serendipity-selector.ts`

## Purpose
Selects up to two adjacent serendipity topics using a high-temperature Anthropic model call.

## Behavior
1. Input includes:
- active topics
- suppressed topics (excluded from proposal)
- user memory text
2. Prompt asks for non-duplicate adjacent topics that broaden lens coverage.
3. Uses model fallback chain:
- `ANTHROPIC_SERENDIPITY_MODEL`
- `ANTHROPIC_LINK_SELECTOR_MODEL`
- `ANTHROPIC_SUMMARY_MODEL`
- `ANTHROPIC_MEMORY_MODEL`
4. Uses elevated temperature (`0.85`) to encourage non-redundant adjacent topic picks.
5. Parses strict JSON output shape:
- `{"topics":["..."],"rationale":"..."}`
6. Applies minimal safety filtering on model outputs (dedupe, drop active/suppressed overlaps, normalize).
7. Returns no serendipity topics when model/env/API is unavailable; caller continues with core lane only.

## Errors
- `INVALID_SERENDIPITY_SELECTOR_RESPONSE`
- `EMPTY_SERENDIPITY_SELECTOR_RESPONSE`
- `ANTHROPIC_SERENDIPITY_SELECTOR_HTTP_<status>`
