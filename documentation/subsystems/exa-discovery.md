# Subsystem: Exa Discovery (PR6)

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Tavily-backed search per topic
- Result normalization and global URL dedupe
- Attempt-tier quality/diversity early-stop gating
- Suppression-aware primary selection with no suppressed fallback
- Quality filtering for low-signal sources and low-score candidates
- Strict one-winner-per-topic primary output selection, then backfill to target count

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic target-count list (default `10`) built from per-topic winners plus staged non-suppressed backfill (topic-balanced first pass), along with topics used, attempts used, warnings, and diversity card metrics.

Integration hook:
- discovery orchestration accepts an optional candidate include predicate for downstream policies (for example PR9 Bloom anti-repeat gating) before final selection.

## Policy Highlights
- Suppressed interests are soft-ranked in topic derivation and excluded from both primary and fallback selection.
- Query construction is topic-focused; optional OpenRouter query-planner can override base topic queries with depth-focused phrasing before provider calls.
- Discovery attempts use calibrated relaxed thresholds to improve first-attempt pass rate while preserving diversity checks.
- Final selection starts strict one-per-topic with weighted topic-local scoring (`exa` weighted higher than highlight score), then backfills to target count with topic-balance preference before relaxed fallback.
- Diversity and source-signal diagnostics are emitted in warnings and `diversityCard`.
