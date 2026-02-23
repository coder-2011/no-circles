# File: `app/api/cron/generate-next/route.ts`

## Purpose
HTTP wrapper around DB-owned selector function plus PR9 single-user send runtime orchestration.

## Input Contract
- Requires service-secret authorization header: `Authorization: Bearer ${CRON_SECRET}`.
- Requires `Content-Type: application/json`.
- Payload hard limit: `4KB`.
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.
- Accepts optional `batch_size` integer override (`1..25`, default `10`).

## Behavior
1. Rejects unauthorized requests with `401 UNAUTHORIZED`.
2. Rejects non-JSON requests with `415 UNSUPPORTED_MEDIA_TYPE`.
3. Rejects oversized request bodies with `413 PAYLOAD_TOO_LARGE`.
4. Parses JSON body (`{}` fallback on malformed JSON).
5. Returns `400 INVALID_PAYLOAD` on schema failure.
6. Calls `public.claim_due_users_batch(run_at_utc, 5, batch_size)` in Postgres.
7. DB selector treats users as due starting 3 minutes before configured local send time (`send_time_local_minute - 3`, clamped to local midnight).
8. Returns `{ ok: true, status: "no_due_user" }` when function returns no rows.
9. Runs send pipeline for claimed users with bounded parallelism.
10. Maps per-user pipeline statuses:
   - `sent`
   - `insufficient_content`
   - `send_failed`
   - `internal_error`
11. Returns batch response:
   - `{ ok: true, status: "processed_batch", requested_batch_size, claimed_user_count, counts, user_results }`
12. Returns `500 INTERNAL_ERROR` when batch selection fails.
13. `GET` returns `405 METHOD_NOT_ALLOWED` (no browser-triggerable send execution).

## Logging
- logs `unauthorized` (with failure reason), `invalid_payload`, `selected_batch`, `no_due_user`, per-user `insufficient_content`/`send_failed`, `method_not_allowed`, and fatal `error` events for cron observability.
