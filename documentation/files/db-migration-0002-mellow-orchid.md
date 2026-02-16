# File: `db/migrations/0002_mellow_orchid.sql`

## Purpose
Adds persisted preferred-name support to user records.

## Schema Changes
- adds `users.preferred_name`
- backfills existing rows from email local-part
- sets `preferred_name` to `NOT NULL`

## Why It Exists
- Enables durable user-preferred naming for downstream newsletter personalization.
- Prevents null-name ambiguity for future email greeting/render paths.
