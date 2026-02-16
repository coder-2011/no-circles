# File: `tests/discovery-run.test.ts`

## Purpose
Validates discovery orchestration behavior end-to-end at service level with mocked Exa responses.

## Coverage
- Deterministic dedupe, one-winner-per-topic primary selection, and backfill-to-target behavior
- Retry path when topic-winner pool is insufficient before backfill
- Attempt-tier early-stop behavior under quality/diversity gates
- Suppression fallback behavior when required for target-count completion
- Low-signal source filtering and score-threshold filtering
- Partial failure behavior with warning emission
- No-active-topics short-circuit behavior
