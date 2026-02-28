# File: `db/migrations/meta/_journal.json`

## Purpose
Migration journal tracking applied/generated migration sequence.

## Behavior
- Records migration ordering metadata used by drizzle-kit runtime/tooling.
- Must include every checked-in migration tag in sequence; missing entries create repo/runtime drift even when the SQL file exists.

## Why It Exists
- Prevents migration history ambiguity and supports repeatable DB state transitions.
