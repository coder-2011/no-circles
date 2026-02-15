# Subsystem: DB and Onboarding

## Scope
Implements foundational persistence and first write path for V1:
- Drizzle + Postgres schema
- migration generation/apply flow
- `POST /api/onboarding` validation + upsert

## Current Implementation
- DB client: `lib/db/client.ts`
- Schema: `lib/db/schema.ts`
- Migration tooling: `drizzle.config.ts` + `db/migrations/*`
- Route: `app/api/onboarding/route.ts`
- Validation: `lib/schemas.ts`
- Tests: `tests/onboarding-schema.test.ts`, `tests/onboarding-route.test.ts`

## Runtime Contract
1. Request hits `POST /api/onboarding`.
2. Payload validated with zod.
3. Route upserts `users` by unique `email`.
4. Response returns `{ ok: true, user_id }`.

Error cases:
- invalid payload -> `400 INVALID_PAYLOAD`
- DB failure -> `500 INTERNAL_ERROR`

## Data Model in Scope
- `users`: `id`, `email`, `timezone`, `send_time_local`, `interest_memory_text`
- `newsletter_items`: `id`, `user_id`, `url`, `title`, `sent_at`
- Constraints:
  - unique `users.email`
  - FK `newsletter_items.user_id -> users.id` (`ON DELETE CASCADE`)
  - unique `newsletter_items(user_id, url)`
  - index `newsletter_items(user_id, sent_at)`

## Known Transitional Decision
- Onboarding currently accepts `email` in payload as identity source until OAuth session wiring is implemented in `feature/google-auth`.
- `preferred_name` is validated at API boundary but not persisted in current minimal schema.
