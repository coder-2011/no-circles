# File: `app/api/cron/generate-next/route.ts`

## Purpose
Thin HTTP wrapper around DB-owned selector function for downstream generation/send work.

## Input Contract
- Requires service-secret authorization header: `Authorization: Bearer ${CRON_SECRET}`.
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.

## Behavior
1. Parses JSON body (`{}` fallback on malformed JSON).
2. Rejects unauthorized requests with `401 UNAUTHORIZED`.
3. Returns `400 INVALID_PAYLOAD` on schema failure.
4. Calls `public.claim_next_due_user(run_at_utc, 5)` in Postgres.
5. Returns `{ ok: true, status: "selected", user_id }` when function returns a user.
6. Returns `{ ok: true, status: "no_due_user" }` when function returns `NULL`.
7. Returns `500 INTERNAL_ERROR` on selector function failures.

## Logging
- logs `unauthorized`, `selected`, `no_due_user`, and `error` events for cron observability.
