# File: `tests/send-user-newsletter.test.ts`

## Purpose
Validates PR9 pipeline orchestration outcomes.

## Coverage
- happy path sends exactly 10 and persists updated Bloom state
- happy path invokes quote-selection dependency before render/send
- insufficient content result when discovery shortfalls
- send failure result with idempotency failed-marking
- unexpected throw after reservation marks idempotency failed (prevents stale `processing` lock)
- post-send user-state persistence failure still returns `sent` after idempotency is marked sent
- duplicate idempotency reservation skips duplicate send
