# File: `tests/discovery-run.test.ts`

## Purpose
Validates discovery orchestration behavior end-to-end at service level with mocked provider responses.

## Coverage
- Deterministic dedupe, one-winner-per-topic primary selection, and backfill-to-target behavior
- Topic-balanced backfill behavior that prefers underrepresented topics before repeating dominant topics
- Retry path when topic-winner pool is insufficient before backfill
- Attempt-tier early-stop behavior under quality/diversity gates
- Suppressed-topic exclusion across primary selection and backfill
- Low-signal source filtering (domain + index/hub/tag path patterns) and score-threshold filtering
- Optional candidate include-filter behavior for downstream anti-repeat gating hooks
- Partial failure behavior with warning emission
- No-active-topics short-circuit behavior
