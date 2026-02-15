# Files: `db/migrations/*`

## Purpose
Versioned SQL history for database schema state.

## Current Migration
- `db/migrations/0000_sour_butterfly.sql`
  - creates `users`
  - creates `newsletter_items`
  - adds FK + indexes + unique constraints

## Metadata
- `db/migrations/meta/_journal.json`: migration journal
- `db/migrations/meta/0000_snapshot.json`: schema snapshot used by drizzle-kit
