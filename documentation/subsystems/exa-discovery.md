# Subsystem: Discovery Retrieval and Ranking

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Perplexity Sonar search per topic
- Anthropic Haiku single-link selection per topic (reorders topic candidates)
- Result normalization and global URL dedupe
- Attempt-tier quality/diversity early-stop gating
- Suppression-aware primary selection with no suppressed fallback
- Quality filtering for low-signal sources and low-score candidates
- Quota-based output selection: evenly allocated core slots across active interests plus reserved serendipity slots

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic target-count list (default `10`) built from quota-based lane allocation (`8` core across active interests as evenly as possible, `2` serendipity from adjacent topics), along with topics used, attempts used, warnings, and diversity card metrics.

Integration hook:
- discovery orchestration accepts an optional candidate include predicate for downstream policies (for example PR9 Bloom anti-repeat gating) before final selection.

## Policy Highlights
- Suppressed interests are soft-ranked in topic derivation and excluded from both primary and fallback selection.
- Query construction is topic-focused with per-topic recency rotation (`last 7 days`, `last 30 days`, `last 90 days`, `last 12 months`, `since previous year`).
- Sonar retrieval prompt enforces strict parseable output format (`[TITLE] || https://...`) for deterministic extraction.
- Haiku selector runs once per topic to choose best candidate link from Sonar outputs.
- Discovery attempts use calibrated relaxed thresholds to improve first-attempt pass rate while preserving diversity checks.
- Final selection is quota-based per topic and lane; it does not backfill excess slots from dominant topics when other topic quotas are underfilled.
- Diversity and source-signal diagnostics are emitted in warnings and `diversityCard`.
