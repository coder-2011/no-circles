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
- `db/migrations/0002_mellow_orchid.sql`
  - adds `users.preferred_name`
  - backfills existing users from email local-part
  - enforces `NOT NULL` after backfill
- `db/migrations/0003_misty_calm.sql`
  - adds nullable `users.last_issue_sent_at`
  - establishes scheduler delivery-state authority on `users` (not `newsletter_items`)

## Metadata
- `db/migrations/meta/_journal.json`: migration journal
- `db/migrations/meta/0000_snapshot.json`: schema snapshot used by drizzle-kit
- `db/migrations/meta/0001_snapshot.json`: schema snapshot after inbound idempotency table addition
- `db/migrations/meta/0002_snapshot.json`: schema snapshot after preferred-name persistence migration
