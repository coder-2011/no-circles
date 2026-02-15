# File: `db/migrations/meta/0001_snapshot.json`

## Purpose
Drizzle schema snapshot after PR3 migration state.

## Behavior
- Captures generated schema metadata that corresponds to `0001_sturdy_ion.sql`.
- Used by drizzle-kit for migration diffing and consistency checks.

## Why It Exists
- Keeps migration generation deterministic and traceable across environments.
