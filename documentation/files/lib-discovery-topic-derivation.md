# File: `lib/discovery/topic-derivation.ts`

## Purpose
Derives deterministic Exa query topics from canonical `interest_memory_text`.

## Behavior
1. Parses canonical memory sections.
2. Reads topics from `ACTIVE_INTERESTS` only.
3. De-duplicates topics while preserving first-seen order.
4. Applies soft suppression ordering using `SUPPRESSED_INTERESTS` (moves down; does not remove).
5. Uses `PERSONALITY` and `RECENT_FEEDBACK` as query context (Option A strategy).

## Output
Returns `DiscoveryTopic[]` with `topic`, `query`, `topicRank`, and `softSuppressed`.
