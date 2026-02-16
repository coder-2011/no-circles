# File: `scripts/setup-supabase-cron.sql`

## Purpose
Defines the Supabase-native scheduler setup that runs cron selector logic inside Postgres every minute.

## What It Configures
- enables `pg_cron` extension
- unschedules prior `newsletter-generate-next-every-minute` job if present
- schedules a minute-level call to `public.claim_next_due_user(now(), 5)`

## Security Notes
- Scheduler execution stays inside Postgres (`pg_cron`).
- No HTTP secret transport is required for the scheduled selector call.

## Operational Notes
- Run this in Supabase SQL Editor (staging first).
- Keep the same job name for idempotent re-runs.
