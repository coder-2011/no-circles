# File: `scripts/prune-inbound-idempotency.ts`

## Purpose
Prunes old `processed_webhooks` rows to keep idempotency storage bounded.

## Policy
- Deletes records older than `30` days.

## Invocation
- Manual/cron script execution in an environment with DB access.
