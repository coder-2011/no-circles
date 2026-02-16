# File: `app/api/cron/generate-next/route.ts`

## Purpose
Selects one due user per cron tick for downstream generation/send work.

## Input Contract
- Requires service-secret authorization header: `Authorization: Bearer ${CRON_SECRET}`.
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.

## Behavior
1. Parses JSON body (`{}` fallback on malformed JSON).
2. Rejects unauthorized requests with `401 UNAUTHORIZED`.
3. Returns `400 INVALID_PAYLOAD` on schema failure.
4. Computes due users from each row's `timezone`, `send_time_local`, and `last_issue_sent_at`.
5. Excludes users already sent on their current local day (`last_issue_sent_at` local date equals run local date).
6. Selects one user deterministically (`last_issue_sent_at` ascending nulls first, then `id` ascending).
7. Returns `{ ok: true, status: "selected", user_id }` when a due user exists.
8. Returns `{ ok: true, status: "no_due_user" }` when queue is empty.
9. Returns `500 INTERNAL_ERROR` on selector failures.

## Logging
- logs `unauthorized`, `selected`, `no_due_user`, and `error` events for cron observability.
