# File: `lib/discovery/topic-derivation.ts`

## Purpose
Derives deterministic Exa query topics from canonical `interest_memory_text`.

## Behavior
1. Parses canonical memory sections.
2. Reads topics from `ACTIVE_INTERESTS`, where plain bullets are treated as core and `[side] topic` bullets are treated as side (via shared parser in `lib/memory/active-interest-lanes.ts`).
3. Prioritizes core topics ahead of side topics, then applies fallback seed topics from `PERSONALITY`/`RECENT_FEEDBACK` when active is empty.
4. Current local implementation no longer emits suppression-ranked topic ordering; derived topics are returned as active or fallback seed topics only.
5. Uses topic-focused queries (`query === topic`) to reduce retrieval-noise from long context strings.

## Output
Returns `DiscoveryTopic[]` with `topic`, `query`, `topicRank`, and `softSuppressed`.
- Current local implementation sets `softSuppressed: false` for all derived topics.
