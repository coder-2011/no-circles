# File: `tests/send-user-newsletter.test.ts`

## Purpose
Validates PR9 pipeline orchestration outcomes.

## Coverage
- happy path sends exactly 10 and persists updated Bloom state
- insufficient content result when discovery shortfalls
- send failure result with idempotency failed-marking
- duplicate idempotency reservation skips duplicate send
