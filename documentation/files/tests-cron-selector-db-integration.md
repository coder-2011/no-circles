# File: `tests/cron-selector-db-integration.test.ts`

## Purpose
Provides fast, high-signal integration checks for DB-owned scheduler selector function `public.claim_next_due_user`.

## Execution Model
- Uses real Postgres via `DATABASE_URL`.
- Entire suite is skipped when `DATABASE_URL` is absent.
- Each test runs inside `BEGIN ... ROLLBACK` to avoid persistent fixture data.

## Covered Cases
- deterministic due-user ordering (`last_issue_sent_at` null first, then older timestamps)
- local-day exclusion when `last_issue_sent_at` is already on user local date
- lease TTL enforcement via `cron_selection_leases`

## Why It Exists
- validates scheduler-critical behavior in the actual database function, not only mocked route-level tests.
- keeps runtime fast while still exercising real SQL semantics.
