# File: `lib/discovery/run-discovery.ts`

## Purpose
Runs one PR6 discovery pass for a user: derive topics, query Sonar, apply per-topic Haiku selection, and orchestrate selection/gating to return final candidates.

Implementation split:
- `lib/discovery/run-discovery.ts`: orchestration entrypoint.
- `lib/discovery/run-discovery-selection.ts`: pure selection, filtering, early-stop, and diversity helpers.

## Input
`DiscoveryRunInput`:
- `interestMemoryText` (required)
- optional knobs: `targetCount`, `maxRetries`, `maxTopics`, `perTopicResults`, `earlyStopBuffer`, `maxPerDomain`

Optional dependency hook:
- `includeCandidate(candidate) -> boolean` for downstream candidate-gating policies (for example Bloom anti-repeat checks).
- `linkSelector({ topic, interestMemoryText, candidates, alreadySelected }) -> selectedIndex | null` to override per-topic winner ordering before normalization.
  - `alreadySelected` contains progressive `{ topic, title }` context from prior topic selections in the same run.
- `excerptExtractor({ url, maxCharacters }) -> string | null` to provide custom URL excerpt extraction when enabled.

## Core Behavior
1. Derive topics from memory.
2. Build per-topic query with recency rotation (`last 7/30/90 days`, `last 12 months`, `since previous year`).
3. Query Perplexity Sonar per topic and normalize results.
   - Sonar system prompt requires strict line format: `[TITLE] || https://...`.
   - malformed lines are ignored during parse.
4. Optional URL excerpt stage (`requireUrlExcerpt`):
   - fetches local excerpt (default 1500 chars) per candidate URL
   - drops candidates when excerpt extraction fails
   - drops candidates when excerpt is navigation-heavy or not-found/metadata-like
5. Run Haiku selector per topic (when topic has >1 candidate) and reorder candidates so selected link is ranked first.
   - selector receives progressive per-issue context (`alreadySelected`) so tie-breaking can prefer non-redundant angles across topics while preserving quality/relevance.
   - selector failures are warning-only.
6. Normalize results into discovery candidates.
   - `exaScore` uses `result.score` when available; falls back to aggregate highlight score when `score` is absent.
   - preserves full `highlights[]` and full `highlightScores[]` on each candidate.
   - `highlightScore` stores aggregate (mean) highlight score for topic-local ranking.
7. Apply optional candidate include hook to normalized candidates.
8. Dedupe globally via canonical URLs.
9. Exclude soft-suppressed topics from the primary quality pool.
10. Apply quality filters before winner selection:
   - require both `title` and `highlight`
   - drop known low-signal source patterns/domains
   - drop scored candidates below minimum `exaScore` threshold.
11. Enforce per-domain cap (`maxPerDomain`) on quality-filtered pool.
12. Perform strict one-winner-per-topic selection using weighted topic-local score:
   - `0.65 * exaNorm + 0.35 * highlightNorm` (weights renormalized when one signal is missing).
13. Backfill to target count (default `10`) in staged order:
   - remaining non-suppressed quality pool (topic-balanced first pass with soft max-topic-share cap)
   - relaxed non-suppressed pool (keeps required title/highlight)
14. Build `diversityCard` on final output with hard thresholds for topic/domain spread.
15. Enforce target-count contract:
   - derives topic seeds from `PERSONALITY` and `RECENT_FEEDBACK` when `ACTIVE_INTERESTS` is empty
   - throws `NO_ACTIVE_TOPICS` only when no active or seed topics can be derived
   - throws `INSUFFICIENT_QUALITY_CANDIDATES:<actual>/<target>` if non-suppressed staged backfill cannot satisfy target count.

## Early-Stop Policy
Attempt-tier gates (strict -> relaxed):
- Attempt 1: min domains `4`, min avg score `0.58`, min highlight coverage `0.75`
- Attempt 2: min domains `4`, min avg score `0.55`, min highlight coverage `0.70`
- Attempt 3+: min domains `3`, min avg score `0.50`, min highlight coverage `0.65`

Stop triggers only when all gates pass for `targetCount + earlyStopBuffer` candidates.
Default `earlyStopBuffer` is `2` and default per-domain cap is `3`.
Default `perTopicResults` is `7` (attempts 2+ increase by `+2` each).

## Retry Strategy
- Attempt 1: base query, base `perTopicResults`
- Attempt 2+: widened query text + larger `numResults`
- Max attempts: `maxRetries` (default 3)

## Error Codes
- `NO_ACTIVE_TOPICS`
- `INSUFFICIENT_QUALITY_CANDIDATES:<actual>/<target>`

## Warning Codes
- `EXA_TOPIC_FAILURE:<topic>:<reason>` (legacy code preserved; includes Sonar failures)
- `TOPIC_SELECTOR_FAILURE:<topic>:<reason>`
- `CANDIDATE_EXTRACTION_FAILED:<topic>:<url>`
- `CANDIDATE_LOW_SIGNAL_EXCERPT:<topic>:<url>`
- `TOPIC_NO_EXTRACTED_CANDIDATES:<topic>`
- `EARLY_STOP_TRIGGERED_ATTEMPT_<n>`
- `LOW_SIGNAL_FILTERED_<n>`
- `LOW_SCORE_FILTERED_<n>`
- `MISSING_FIELDS_FILTERED_<n>`
- `LOW_TOPIC_WINNER_SCORE_<n>`
- `INSUFFICIENT_TOPIC_WINNERS`
- `NON_SUPPRESSED_POOL_BELOW_TARGET`
- `BACKFILLED_FROM_QUALITY_POOL_<n>`
- `RELAXED_TOPIC_BALANCE_BACKFILL_<n>`
- `RELAXED_QUALITY_BACKFILL_<n>`
- `CANDIDATE_FILTERED_<n>`
- `DIVERSITY_CARD_FAILED`
