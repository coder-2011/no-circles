# File: `db/migrations/meta/_journal.json`

## Purpose
Migration journal tracking applied/generated migration sequence.

## Behavior
- Records migration ordering metadata used by drizzle-kit runtime/tooling.

## Why It Exists
- Prevents migration history ambiguity and supports repeatable DB state transitions.
