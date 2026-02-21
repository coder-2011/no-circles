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
4. Selector prompt enforces weighted scoring guidance (`topic_fit`, `novelty_vs_memory`, `evidence_density`, `actionability`, `credibility_signal`) plus hard reject rules for low-signal SEO-like pages.
5. Selector prompt includes cross-topic diversity-aware tie-break guidance (without hard quotas), novelty/progression + advanced-reader self-check, and allows explicit `NULL` when no candidate clears quality bar.
6. Expects strict JSON output: `{"selected_index": <1-based integer or "NULL">, "rationale": "<short text>"}`.
7. Parses JSON output first and retains integer-text fallback parsing for compatibility.
8. Returns zero-based selected index or `null`.

## Errors
- `MISSING_ANTHROPIC_API_KEY`
- `MISSING_ANTHROPIC_SELECTOR_MODEL`
- `ANTHROPIC_SELECTOR_HTTP_<status>`
- `INVALID_SELECTOR_RESPONSE`
- `EMPTY_SELECTOR_RESPONSE`
