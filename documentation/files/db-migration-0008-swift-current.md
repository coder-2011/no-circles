# File: `db/migrations/0008_swift_current.sql`

## Purpose
Adds DB-owned batch due-user claiming so scheduler can lease multiple due users per invocation while preserving existing lease TTL and local-day exclusion rules.

## Schema Changes
- adds function `public.claim_due_users_batch(p_run_at_utc, p_lease_ttl_minutes, p_batch_size)`
- returns a table of claimed `user_id` values in deterministic due-order
- caps effective batch size to `1..100` inside function for safety

## Rationale
- improves scheduler throughput by replacing repeated single-claim calls with one batched claim query
- keeps claiming authority and lock semantics in Postgres (`FOR UPDATE SKIP LOCKED` + lease upsert guard)
