# File: `db/migrations/0011_clear_output.sql`

## Purpose
Resolves ambiguous column output in the batch lease upsert step.

## Function Update
- replaces `public.claim_due_users_batch(...)`
- keeps all existing lock/rank/limit behavior from `0010`
- changes lease CTE return clause to:
  - `RETURNING public.cron_selection_leases.user_id`

## Rationale
- removes ambiguity between output `user_id` symbols in the upsert context
- restores stable execution of batch claim integration tests
