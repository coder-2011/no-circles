# Subsystem: Scheduler and Cron Trigger

## Scope
Owns scheduled invocation of `POST /api/cron/generate-next` and the separate admin monitoring cron trigger `POST /api/cron/admin-monitor`.

## Current Implementation
- Scheduler runtime: Supabase `pg_cron`
- Trigger path owner: Postgres `pg_cron` + `pg_net` HTTP call to app route
- Batch selector owner: Postgres function `public.claim_due_users_batch(...)`
- Send runtime owner: `app/api/cron/generate-next/route.ts`
- Admin monitoring owner: `app/api/cron/admin-monitor/route.ts`
- Setup script: `scripts/setup-supabase-cron.sql`

## Runtime Contract
1. Every minute, Supabase cron job calls `POST /api/cron/generate-next` via `net.http_post(...)`.
2. Route validates `CRON_SECRET`, then calls `public.claim_due_users_batch(run_at_utc, 5, batch_size)`.
3. DB function opens due eligibility 3 minutes before each configured local send time (clamped at local `00:00`), then handles deterministic ordering, local-day exclusion, and short lease claim in DB.
4. Route runs send pipeline for each claimed user with bounded concurrency.
5. Route returns `no_due_user` when queue is empty, otherwise batch result status.
6. A second daily cron job prunes `processed_webhooks` rows older than 30 days.
7. A separate daily cron job calls `POST /api/cron/admin-monitor` to send the admin digest and evaluate provider thresholds.
8. Scheduler selector functions pin `search_path = public` so runtime object resolution does not depend on caller/session path.

## Secrets Required
- `CRON_SECRET` is required and passed by cron HTTP trigger.
- Scheduler script must include deployed app base URL for route target.
- `ADMIN_MONITOR_CRON_SECRET` may override `CRON_SECRET` for the admin monitor route; otherwise it falls back to `CRON_SECRET`.

## Boundary Notes
- This subsystem owns scheduling, due-user selection, and route triggering.
- Content generation and delivery execute inside the cron route's send pipeline.
- Admin monitoring stays operationally separate from the user newsletter send path even though both jobs are triggered from Supabase cron.
