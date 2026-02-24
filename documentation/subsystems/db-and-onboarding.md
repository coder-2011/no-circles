# Subsystem: DB and Onboarding

## Scope
Implements foundational persistence and onboarding write path for V1:
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
6. If upsert is a first insert, route triggers best-effort onboarding kickoff as two separate sends:
   - welcome intro transactional email
   - welcome issue send (5 items, `welcome` variant)
7. Response returns `{ ok: true, user_id }`.

Error cases:
- invalid payload -> `400 INVALID_PAYLOAD`
- missing auth session -> `401 UNAUTHORIZED`
- DB failure -> `500 INTERNAL_ERROR`
- memory processor failure -> `500 INTERNAL_ERROR`

## Data Model in Scope
- `users`: `id`, `email`, `preferred_name`, `timezone`, `send_time_local`, `interest_memory_text`, `last_issue_sent_at`
- `processed_webhooks`: `id`, `provider`, `webhook_id`, `processed_at`
- Constraints:
  - unique `users.email`
  - unique `processed_webhooks(provider, webhook_id)`
  - index `processed_webhooks(processed_at)`

## Anti-Repeat Direction
- Anti-repeat authority is per-user Bloom filter state.
- `newsletter_items` has been removed from active schema.

## Preferred Name Persistence
- `preferred_name` is persisted in `users.preferred_name` on both insert and upsert update paths.
- Existing users are backfilled in migration `0002_mellow_orchid` using email local-part.

## Boundary Note
Inbound reply webhook processing now has its own subsystem document:
- `documentation/subsystems/inbound-reply-memory-update.md`

Scheduler due-user selection uses `users.last_issue_sent_at` as delivery-state authority and is documented in:
- `documentation/files/app-api-cron-generate-next-route.md`
