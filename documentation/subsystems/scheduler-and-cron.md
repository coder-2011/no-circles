# Subsystem: Scheduler and Cron Trigger

## Scope
Owns scheduled invocation of `POST /api/cron/generate-next`.

## Current Implementation
- Scheduler runtime: Supabase `pg_cron`
- Trigger path owner: Postgres `pg_cron` + `pg_net` HTTP call to app route
- Batch selector owner: Postgres function `public.claim_due_users_batch(...)`
- Send runtime owner: `app/api/cron/generate-next/route.ts`
- Setup script: `scripts/setup-supabase-cron.sql`

## Runtime Contract
1. Every minute, Supabase cron job calls `POST /api/cron/generate-next` via `net.http_post(...)`.
2. Route validates `CRON_SECRET`, then calls `public.claim_due_users_batch(run_at_utc, 5, batch_size)`.
3. DB function opens due eligibility 3 minutes before each configured local send time (clamped at local `00:00`), then handles deterministic ordering, local-day exclusion, and short lease claim in DB.
4. Route runs send pipeline for each claimed user with bounded concurrency.
5. Route returns `no_due_user` when queue is empty, otherwise batch result status.
6. A second daily cron job prunes `processed_webhooks` rows older than 30 days.
7. Scheduler selector functions pin `search_path = public` so runtime object resolution does not depend on caller/session path.

## Secrets Required
- `CRON_SECRET` is required and passed by cron HTTP trigger.
- Scheduler script must include deployed app base URL for route target.

## Boundary Notes
- This subsystem owns scheduling, due-user selection, and route triggering.
- Content generation and delivery execute inside the cron route's send pipeline.
