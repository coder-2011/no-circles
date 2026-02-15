# File: `drizzle.config.ts`

## Purpose
Central config for drizzle-kit commands (`generate`, `migrate`).

## Current Config
- schema path: `./lib/db/schema.ts`
- migrations out dir: `./db/migrations`
- dialect: `postgresql`
- credentials source: `DATABASE_URL`
- strict mode + verbose logs enabled

## Notes
- `DATABASE_URL` must be set before running drizzle-kit commands.
- Migration metadata lives under `db/migrations/meta/`.
