# File: `lib/db/client.ts`

## Purpose
Creates and exports shared DB access objects:
- `pool` (`pg` connection pool)
- `db` (Drizzle client with typed schema)

## Key Behavior
- Fails fast if `DATABASE_URL` is missing.
- Normalizes `DATABASE_URL` by auto-adding `uselibpqcompat=true` when SSL mode is `prefer`, `require`, or `verify-ca` and the flag is absent.
- Reuses a singleton pool in non-production to prevent excess DB connections during Next.js hot reload.
- Registers schema with Drizzle for typed query usage.
