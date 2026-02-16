# File: `lib/discovery/run-discovery.ts`

## Purpose
Runs one PR6 discovery pass for a user: derive topics, query Exa, normalize, dedupe, enforce quality/diversity gates, and return final candidates.

## Input
`DiscoveryRunInput`:
- `interestMemoryText` (required)
- optional knobs: `targetCount`, `maxRetries`, `maxTopics`, `perTopicResults`, `earlyStopBuffer`, `maxPerDomain`

## Core Behavior
1. Derive topics from memory.
2. Query Exa per topic and normalize results.
3. Dedupe globally via canonical URLs.
4. Hard-exclude soft-suppressed topics from final candidates.
5. Enforce per-domain cap (`maxPerDomain`) for diversity-first selection.
6. If cap blocks fill, relax cap only as final backfill step to keep filling toward target.

## Early-Stop Policy
Attempt-tier gates (strict -> relaxed):
- Attempt 1: min domains `4`, min avg score `0.58`, min highlight coverage `0.75`
- Attempt 2: min domains `4`, min avg score `0.55`, min highlight coverage `0.70`
- Attempt 3+: min domains `3`, min avg score `0.50`, min highlight coverage `0.65`

Stop triggers only when all gates pass for `targetCount + earlyStopBuffer` candidates.
Default `earlyStopBuffer` is `2` and default per-domain cap is `3`.

## Retry Strategy
- Attempt 1: base query, base `perTopicResults`
- Attempt 2+: widened query text + larger `numResults`
- Max attempts: `maxRetries` (default 3)

## Warning Codes
- `NO_ACTIVE_TOPICS`
- `EXA_TOPIC_FAILURE:<topic>:<reason>`
- `EARLY_STOP_TRIGGERED_ATTEMPT_<n>`
- `INSUFFICIENT_UNIQUE_CANDIDATES`
- `NON_SUPPRESSED_POOL_BELOW_TARGET`
