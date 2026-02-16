# File: `app/api/cron/generate-next/route.ts`

## Purpose
HTTP wrapper around DB-owned selector function plus PR9 single-user send runtime orchestration.

## Input Contract
- Requires service-secret authorization header: `Authorization: Bearer ${CRON_SECRET}`.
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.

## Behavior
1. Parses JSON body (`{}` fallback on malformed JSON).
2. Rejects unauthorized requests with `401 UNAUTHORIZED`.
3. Returns `400 INVALID_PAYLOAD` on schema failure.
4. Calls `public.claim_next_due_user(run_at_utc, 5)` in Postgres.
5. Returns `{ ok: true, status: "no_due_user" }` when function returns `NULL`.
6. When function returns a user, executes PR9 pipeline for that selected user.
7. Maps pipeline statuses:
   - `{ ok: true, status: "sent", user_id, provider_message_id }`
   - `{ ok: true, status: "insufficient_content", user_id }`
   - `{ ok: true, status: "send_failed", user_id }`
8. Returns `500 INTERNAL_ERROR` when selector fails or pipeline reports internal error.

## Logging
- logs `unauthorized`, `selected`, `no_due_user`, `insufficient_content`, `send_failed`, and fatal `error` events for cron observability.
