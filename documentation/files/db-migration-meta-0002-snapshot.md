# File: `db/migrations/meta/0002_snapshot.json`

## Purpose
Drizzle schema snapshot after preferred-name persistence migration.

## Behavior
- Captures generated schema metadata that corresponds to `0002_mellow_orchid.sql`.
- Includes `users.preferred_name` in the users table column set.

## Why It Exists
- Keeps migration diffing deterministic for future schema updates.
- Ensures tooling sees preferred-name persistence as baseline state.
