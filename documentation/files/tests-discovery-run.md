# File: `tests/discovery-run.test.ts`

## Purpose
Validates discovery orchestration behavior end-to-end at service level with mocked Exa responses.

## Coverage
- Deterministic dedupe and canonical URL handling
- Retry path when duplicates collapse candidate pool
- Partial failure behavior with warning emission
- No-active-topics short-circuit behavior
