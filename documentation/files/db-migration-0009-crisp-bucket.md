# File: `db/migrations/0009_crisp_bucket.sql`

## Purpose
Adds a precomputed due-time bucket for each user and updates batch claim SQL to use integer minute comparisons instead of repeated `split_part` string parsing.

## Schema Changes
- adds generated column `users.send_time_local_minute` (`0..1439`) derived from `send_time_local`
- adds index `users_send_time_local_minute_idx`
- replaces `public.claim_due_users_batch(...)` body to compare:
  - caller local minute at `p_run_at_utc`
  - against precomputed `users.send_time_local_minute`

## Rationale
- removes repeated `split_part(...)` + `make_time(...)` parsing work in hot scheduler path
- keeps all scheduler authority in Postgres while reducing per-row compute overhead
