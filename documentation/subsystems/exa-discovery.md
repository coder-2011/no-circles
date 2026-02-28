# Subsystem: Discovery Retrieval and Ranking

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Perplexity Sonar search per topic
- Anthropic Haiku single-link selection per topic (reorders topic candidates)
- Result normalization and global URL dedupe
- Attempt-tier quality/diversity early-stop gating
- Quality filtering for low-signal sources and low-score candidates
- Quota-based output selection: evenly allocated core slots across active interests plus reserved serendipity slots

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic target-count list (default `10`) built from quota-based lane allocation with adaptive serendipity:
- `<=2` active interests -> `5` core + `5` serendipity
- `3-4` active interests -> `7` core + `3` serendipity
- `>=5` active interests -> `8` core + `2` serendipity
along with topics used, attempts used, warnings, and diversity card metrics.

Integration hook:
- discovery orchestration accepts an optional candidate include predicate for downstream policies (for example PR9 Bloom anti-repeat gating) before final selection.

## Policy Highlights
- Current local implementation reads canonical memory via the 3-section parser (`PERSONALITY`, `ACTIVE_INTERESTS`, `RECENT_FEEDBACK`) while retaining legacy parse compatibility for older stored memory that still contains `SUPPRESSED_INTERESTS`.
- Query construction is topic-focused with per-topic recency rotation (`last 7 days`, `last 30 days`, `last 90 days`, `last 12 months`, `since previous year`).
- Sonar retrieval now uses a more exploratory prompt stance and a higher generation temperature (`1.65`) while still enforcing strict parseable output format (`[TITLE] || https://...`) for deterministic extraction.
- Haiku selector runs once per topic to choose best candidate link from Sonar outputs.
- Active topics are selected first; serendipity only receives lane budget when `maxTopics` leaves room beyond the chosen active-topic set.
- Discovery attempts use calibrated relaxed thresholds to improve first-attempt pass rate while preserving diversity checks.
- Final selection is quota-based per topic and lane, then may backfill from the overall quality pool when strict per-topic quotas would otherwise underfill the target count.
- Diversity and source-signal diagnostics are emitted in warnings and `diversityCard`.
