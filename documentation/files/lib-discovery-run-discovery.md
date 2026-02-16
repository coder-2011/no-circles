# File: `lib/discovery/run-discovery.ts`

## Purpose
Runs one PR6 discovery pass for a user: derive topics, query Exa, and orchestrate selection/gating to return final candidates.

Implementation split:
- `lib/discovery/run-discovery.ts`: orchestration entrypoint.
- `lib/discovery/run-discovery-selection.ts`: pure selection, filtering, early-stop, and diversity helpers.

## Input
`DiscoveryRunInput`:
- `interestMemoryText` (required)
- optional knobs: `targetCount`, `maxRetries`, `maxTopics`, `perTopicResults`, `earlyStopBuffer`, `maxPerDomain`

## Core Behavior
1. Derive topics from memory.
2. Query Exa per topic and normalize results.
   - `exaScore` uses `result.score` when available; falls back to first `highlightScores` value when `score` is absent.
   - `highlightScore` stores first `highlightScores` value for topic-local ranking.
3. Dedupe globally via canonical URLs.
4. Exclude soft-suppressed topics from the primary quality pool.
5. Apply quality filters before winner selection:
   - require both `title` and `highlight`
   - drop known low-signal source patterns/domains
   - drop scored candidates below minimum `exaScore` threshold.
6. Enforce per-domain cap (`maxPerDomain`) on quality-filtered pool.
7. Perform strict one-winner-per-topic selection using weighted topic-local score:
   - `0.65 * exaNorm + 0.35 * highlightNorm` (weights renormalized when one signal is missing).
8. Backfill to target count (default `10`) in staged order:
   - remaining non-suppressed quality pool
   - relaxed non-suppressed pool (keeps required title/highlight)
   - suppressed-topic fallback pools when required to reach target count
9. Build `diversityCard` on final output with hard thresholds for topic/domain spread.
10. Enforce target-count contract:
   - throws `NO_ACTIVE_TOPICS` when no active topic can be derived
   - throws `INSUFFICIENT_CANDIDATES_FOR_TARGET_COUNT:<actual>/<target>` if staged backfill still cannot satisfy target count.

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

## Error Codes
- `NO_ACTIVE_TOPICS`
- `INSUFFICIENT_CANDIDATES_FOR_TARGET_COUNT:<actual>/<target>`

## Warning Codes
- `EXA_TOPIC_FAILURE:<topic>:<reason>`
- `EARLY_STOP_TRIGGERED_ATTEMPT_<n>`
- `LOW_SIGNAL_FILTERED_<n>`
- `LOW_SCORE_FILTERED_<n>`
- `MISSING_FIELDS_FILTERED_<n>`
- `LOW_TOPIC_WINNER_SCORE_<n>`
- `INSUFFICIENT_TOPIC_WINNERS`
- `NON_SUPPRESSED_POOL_BELOW_TARGET`
- `BACKFILLED_FROM_QUALITY_POOL_<n>`
- `RELAXED_QUALITY_BACKFILL_<n>`
- `RELAXED_SUPPRESSION_BACKFILL_<n>`
- `RELAXED_SUPPRESSION_QUALITY_BACKFILL_<n>`
- `DIVERSITY_CARD_FAILED`
