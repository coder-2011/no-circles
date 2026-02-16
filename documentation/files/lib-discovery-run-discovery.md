# File: `lib/discovery/run-discovery.ts`

## Purpose
Runs one PR6 discovery pass for a user: derive topics, query Exa, normalize, dedupe, retry, and return final candidates.

## Input
`DiscoveryRunInput`:
- `interestMemoryText` (required)
- optional knobs: `targetCount`, `maxRetries`, `maxTopics`, `perTopicResults`

## Core Behavior
1. Derive topics from memory.
2. Query Exa per topic.
3. Normalize raw results to `DiscoveryCandidate`.
4. Canonicalize URLs and dedupe globally.
5. Retry up to `maxRetries` when unique pool is below target.
6. Return deterministic candidate list capped to target.

## Retry Strategy
- Attempt 1: base query, base `perTopicResults`
- Attempt 2+: widened query text + larger `numResults`

## Warning Codes
- `NO_ACTIVE_TOPICS`
- `EXA_TOPIC_FAILURE:<topic>:<reason>`
- `INSUFFICIENT_UNIQUE_CANDIDATES`
