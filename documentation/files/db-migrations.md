# Files: `db/migrations/*`

## Purpose
Versioned SQL history for database schema state.

## Current Migration
- `db/migrations/0000_sour_butterfly.sql`
  - creates `users`
  - creates `newsletter_items`
  - adds FK + indexes + unique constraints
- `db/migrations/0001_sturdy_ion.sql`
  - creates `processed_webhooks`
  - adds unique index on `(provider, webhook_id)` for inbound idempotency
  - adds `processed_at` index for 30-day retention pruning

## Metadata
- `db/migrations/meta/_journal.json`: migration journal
- `db/migrations/meta/0000_snapshot.json`: schema snapshot used by drizzle-kit
- `db/migrations/meta/0001_snapshot.json`: schema snapshot after inbound idempotency table addition
