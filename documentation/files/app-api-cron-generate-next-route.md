# File: `app/api/cron/generate-next/route.ts`

## Purpose
HTTP wrapper around DB-owned selector function plus PR9 single-user send runtime orchestration.

## Input Contract
- Requires service-secret authorization header: `Authorization: Bearer ${CRON_SECRET}`.
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.
- Accepts optional `batch_size` integer override (`1..25`).

## Behavior
1. Parses JSON body (`{}` fallback on malformed JSON).
2. Rejects unauthorized requests with `401 UNAUTHORIZED`.
3. Returns `400 INVALID_PAYLOAD` on schema failure.
4. Calls `public.claim_due_users_batch(run_at_utc, 5, batch_size)` in Postgres.
5. Returns `{ ok: true, status: "no_due_user" }` when function returns no rows.
6. Runs send pipeline for claimed users with bounded parallelism.
7. Maps per-user pipeline statuses:
   - `sent`
   - `insufficient_content`
   - `send_failed`
   - `internal_error`
8. Returns batch response:
   - `{ ok: true, status: "processed_batch", requested_batch_size, claimed_user_count, counts, user_results }`
9. Returns `500 INTERNAL_ERROR` when batch selection fails.

## Logging
- logs `unauthorized`, `selected_batch`, `no_due_user`, per-user `insufficient_content`/`send_failed`, and fatal `error` events for cron observability.
