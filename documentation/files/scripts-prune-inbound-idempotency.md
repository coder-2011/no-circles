# File: `scripts/prune-inbound-idempotency.ts`

## Purpose
Prunes old `processed_webhooks` rows to keep idempotency storage bounded.

## Policy
- Deletes records older than `30` days.

## Invocation
- Manual script execution in an environment with DB access.
- Production default is DB-native scheduled cleanup via `scripts/setup-supabase-cron.sql` job `prune-processed-webhooks-daily`.
