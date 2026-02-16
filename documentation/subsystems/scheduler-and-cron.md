# Subsystem: Scheduler and Cron Trigger

## Scope
Owns scheduled invocation of `POST /api/cron/generate-next`.

## Current Implementation
- Scheduler runtime: Supabase `pg_cron`
- Selector logic owner: Postgres function `public.claim_next_due_user(...)`
- Optional HTTP wrapper: `app/api/cron/generate-next/route.ts`
- Setup script: `scripts/setup-supabase-cron.sql`

## Runtime Contract
1. Every minute, Supabase cron job executes `public.claim_next_due_user(now(), 5)`.
2. Function handles due-user ordering, local-day exclusion, and short lease claim in DB.
3. Function returns selected `user_id` or `NULL` when no due user is available.

## Secrets Required
- None for the scheduled selector itself (DB-internal execution).
- `CRON_SECRET` remains required only when calling the HTTP wrapper route.

## Boundary Notes
- This subsystem owns scheduling and due-user selection.
- Content generation, delivery, and history persistence are downstream subsystems.
