# File: `db/migrations/0010_calm_lockstep.sql`

## Purpose
Fixes the batch claim function implementation so PostgreSQL row-locking semantics remain valid while keeping deterministic ranking.

## Function Update
- replaces `public.claim_due_users_batch(...)`
- splits logic into:
  - `locked_candidates`: applies due filters and acquires row locks with `FOR UPDATE SKIP LOCKED`
  - `due_candidates`: computes deterministic rank using `row_number()`
  - `limited_candidates`: enforces requested batch size
  - `leased`: writes/refreshes lease rows

## Rationale
- PostgreSQL does not allow `FOR UPDATE` and window functions at the same query level.
- This shape preserves correctness and concurrency behavior without giving up deterministic order.
