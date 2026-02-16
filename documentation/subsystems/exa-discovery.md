# Subsystem: Exa Discovery (PR6)

## Scope
Implements candidate discovery stage only.

## In Scope
- Topic derivation from canonical user memory (`ACTIVE_INTERESTS` source of topics)
- Exa search per topic
- Result normalization and global URL dedupe
- Retry expansion when unique candidate pool is insufficient

## Out of Scope
- Extraction/fetch fallback (PR7)
- Summary generation (PR8)
- Email send and history persistence (PR9)
- Scheduler due-user selection logic (PR5)

## Runtime Contract
Input: `interest_memory_text` and run knobs.
Output: deterministic deduped candidate list (default target 10), topics used, attempts used, warnings.
