# File: `lib/discovery/topic-derivation.ts`

## Purpose
Derives deterministic discovery query topics from canonical `interest_memory_text`.

## Behavior
1. Parses canonical memory sections.
2. Reads topics from `ACTIVE_INTERESTS` only (fallback: seed topics from `PERSONALITY`/`RECENT_FEEDBACK` when active is empty).
3. De-duplicates topics while preserving first-seen order.
4. Applies soft suppression ordering using `SUPPRESSED_INTERESTS` (moves down; does not remove).
5. Uses topic-focused queries (`query === topic`) to reduce retrieval-noise from long context strings.

## Output
Returns `DiscoveryTopic[]` with `topic`, `query`, `topicRank`, and `softSuppressed`.
