# File: `app/api/cron/admin-monitor/route.ts`

## Purpose
Runs the daily admin monitoring pass without touching the normal user newsletter send pipeline.

## Input Contract
- requires bearer auth using `ADMIN_MONITOR_CRON_SECRET` when set, otherwise `CRON_SECRET`
- accepts `POST`
- `GET` returns `405 METHOD_NOT_ALLOWED`

## Behavior
1. validates cron authorization
2. collects provider snapshots for Anthropic, Exa, Deepgram, Resend, and Perplexity
3. emits `error` logs if a provider check itself fails
4. sends threshold alerts for provider snapshots in `warn` or `error` state
5. sends one daily admin digest email
6. returns the provider status summary as JSON

## Separation Guarantee
- this route is operational-only
- it does not claim due users
- it does not generate user newsletters
- it does not reuse outbound newsletter idempotency state
