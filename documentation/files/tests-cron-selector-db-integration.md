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
- 3-minute pre-send eligibility window for `claim_next_due_user` (not due at `T-4`, due at `T-3`)
- matching 3-minute pre-send eligibility behavior for `claim_due_users_batch`

## Why It Exists
- validates scheduler-critical behavior in the actual database function, not only mocked route-level tests.
- keeps runtime fast while still exercising real SQL semantics.
