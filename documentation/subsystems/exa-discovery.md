# Subsystem: Exa Discovery (PR6)

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Exa search per topic
- Result normalization and global URL dedupe
- Attempt-tier quality/diversity early-stop gating
- Hard suppression exclusion in final candidate output

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic deduped candidate list (default target 10), topics used, attempts used, warnings.

## Policy Highlights
- Suppressed interests are soft-ranked in topic derivation but hard-excluded at final candidate output.
- Discovery attempts relax quality thresholds gradually while still prioritizing diversity.
- System tries to fill to target count from non-suppressed pool whenever possible.
