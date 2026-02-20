# File: `tests/hyper/cron-batch-live-concurrency.integration.test.ts`

## Purpose
Live integration test for cron batch claiming concurrency using real Postgres state.

## Coverage
- computes `run_at_utc` as now plus one minute
- seeds three due users with mixed time zones (`UTC`, `America/New_York`, `Asia/Tokyo`)
- runs three concurrent `claim_due_users_batch(..., 5, 1)` calls
- asserts:
  - exactly three non-null claims
  - all claimed IDs are unique
  - at least one seeded test user is claimed

## Operational Notes
- skips automatically when `DATABASE_URL` is missing
- uses TLS compatibility helper for hosted Postgres SSL mode quirks
- cleans up seeded users by unique email prefix
