# File: `db/migrations/0004_steady_spark.sql`

## Purpose
Moves due-user selector ownership into Postgres with durable short-lease protection.

## Behavior
- creates `cron_selection_leases`
- primary key on `user_id`
- foreign key `user_id -> users.id` (`ON DELETE CASCADE`)
- stores `leased_at` timestamp
- adds index on `leased_at`
- creates `public.claim_next_due_user(p_run_at_utc, p_lease_ttl_minutes)` function
- function enforces due-time + already-sent-local-day + deterministic ordering rules
- function performs lease claim atomically and returns selected `user_id` or `NULL`

## Why It Exists
- makes scheduler logic DB-native for Supabase cron execution
- keeps API route as thin wrapper instead of owning selection SQL logic
