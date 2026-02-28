# File: `lib/discovery/haiku-serendipity-selector.ts`

## Purpose
Selects up to two adjacent serendipity topics using a high-temperature Anthropic model call.

## Behavior
1. Input includes:
- active topics
- user memory text
2. Uses a role-oriented Anthropic system prompt (`senior cross-domain editor`) and a user prompt asking for non-duplicate adjacent topics that broaden lens coverage.
3. The explicit `activeTopics` list is the authority for what the reader currently wants.
4. The prompt explains section-specific usage of `interestMemoryText`:
 - `PERSONALITY`: infer learning style, abstraction level, and what kinds of adjacent topics will feel naturally interesting
 - `RECENT_FEEDBACK`: expand toward reinforced directions and avoid adjacent areas that would repeat downweighted themes
5. The prompt excludes the `ACTIVE_INTERESTS` section from the memory-context block to avoid duplicating active-topic information already passed separately.
6. Uses model fallback chain:
- `ANTHROPIC_SERENDIPITY_MODEL`
- `ANTHROPIC_LINK_SELECTOR_MODEL`
- `ANTHROPIC_SUMMARY_MODEL`
- `ANTHROPIC_MEMORY_MODEL`
7. Uses elevated temperature (`0.85`) to encourage non-redundant adjacent topic picks.
8. Parses strict JSON output shape:
- `{"topics":["..."]}`
9. Applies minimal safety filtering on model outputs (dedupe, drop active overlaps, normalize).
10. Returns no serendipity topics when model/env/API is unavailable; caller continues with core lane only.

## Errors
- `INVALID_SERENDIPITY_SELECTOR_RESPONSE`
- `EMPTY_SERENDIPITY_SELECTOR_RESPONSE`
- `ANTHROPIC_SERENDIPITY_SELECTOR_HTTP_<status>`
