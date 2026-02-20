# File: `scripts/setup-supabase-cron.sql`

## Purpose
Defines Supabase-native scheduler jobs for newsletter triggering and inbound webhook idempotency retention cleanup.

## What It Configures
- enables `pg_cron` extension
- enables `pg_net` extension
- unschedules prior `newsletter-generate-next-every-minute` job if present
- unschedules prior `prune-processed-webhooks-daily` job if present
- schedules a minute-level `net.http_post(...)` call to `POST /api/cron/generate-next` with bearer auth
- schedules a daily SQL cleanup that deletes `processed_webhooks` rows older than 30 days

## Security Notes
- Scheduler execution stays inside Postgres (`pg_cron`) but performs outbound HTTP via `pg_net`.
- Cron route authentication is enforced by `CRON_SECRET` in the Authorization header.
- Script contains placeholders for app URL and cron secret and must be edited before execution.

## Operational Notes
- Run this in Supabase SQL Editor (staging first).
- Keep the same job names for idempotent re-runs.
