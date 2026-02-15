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
- Memory contract + processors: `lib/memory/contract.ts`, `lib/memory/processors.ts`
- OAuth callback route: `app/auth/callback/route.ts`
- Onboarding UI route: `app/onboarding/page.tsx`
- Browser auth client: `lib/auth/browser-client.ts`
- Validation: `lib/schemas.ts`
- Tests: `tests/onboarding-schema.test.ts`, `tests/onboarding-route.test.ts`

## Runtime Contract
1. Request hits `POST /api/onboarding`.
2. Payload validated with zod.
3. Route resolves authenticated user email from session.
4. Route transforms `brain_dump_text` into canonical memory format.
5. Route upserts `users` by unique authenticated email.
4. Response returns `{ ok: true, user_id }`.

Error cases:
- invalid payload -> `400 INVALID_PAYLOAD`
- missing auth session -> `401 UNAUTHORIZED`
- DB failure -> `500 INTERNAL_ERROR`
- memory processor failure -> `500 INTERNAL_ERROR`

## Data Model in Scope
- `users`: `id`, `email`, `timezone`, `send_time_local`, `interest_memory_text`
- `newsletter_items`: `id`, `user_id`, `url`, `title`, `sent_at`
- `processed_webhooks`: `id`, `provider`, `webhook_id`, `processed_at`
- Constraints:
  - unique `users.email`
  - FK `newsletter_items.user_id -> users.id` (`ON DELETE CASCADE`)
  - unique `newsletter_items(user_id, url)`
  - index `newsletter_items(user_id, sent_at)`
  - unique `processed_webhooks(provider, webhook_id)`
  - index `processed_webhooks(processed_at)`

## Known Transitional Decision
- `preferred_name` is validated at API boundary but not persisted in current minimal schema.

## Boundary Note
Inbound reply webhook processing now has its own subsystem document:
- `documentation/subsystems/inbound-reply-memory-update.md`
