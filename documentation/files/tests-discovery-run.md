# File: `tests/discovery-run.test.ts`

## Purpose
Validates discovery orchestration behavior end-to-end at service level with mocked Exa responses.

## Coverage
- Deterministic dedupe and canonical URL handling
- Retry path when duplicates collapse candidate pool
- Attempt-tier early-stop behavior under quality/diversity gates
- Hard suppression exclusion from final candidates
- Domain-cap-aware fill behavior
- Partial failure behavior with warning emission
- No-active-topics short-circuit behavior
