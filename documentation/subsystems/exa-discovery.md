# Subsystem: Exa Discovery (PR6)

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Exa search per topic
- Result normalization and global URL dedupe
- Attempt-tier quality/diversity early-stop gating
- Suppression-aware primary selection with optional suppressed fallback for target-count completion
- Quality filtering for low-signal sources and low-score candidates
- Strict one-winner-per-topic primary output selection, then backfill to target count

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic target-count list (default `10`) built from per-topic winners plus staged backfill, along with topics used, attempts used, warnings, and diversity card metrics.

## Policy Highlights
- Suppressed interests are soft-ranked in topic derivation and excluded from primary selection; suppressed fallback is only used when required to satisfy target-count contract.
- Discovery attempts use calibrated relaxed thresholds to improve first-attempt pass rate while preserving diversity checks.
- Final selection starts strict one-per-topic with weighted topic-local scoring (`exa` weighted higher than highlight score), then backfills to target count.
- Diversity and source-signal diagnostics are emitted in warnings and `diversityCard`.
