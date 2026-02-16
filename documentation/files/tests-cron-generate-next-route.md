# File: `tests/cron-generate-next-route.test.ts`

## Purpose
Protects cron selector + PR9 send-runtime route contract for authorization, selection, status mapping, and empty-queue behavior.

## Covered Cases
- unauthorized request -> `401 UNAUTHORIZED`
- wrong bearer token -> `401 UNAUTHORIZED`
- missing `CRON_SECRET` -> `401 UNAUTHORIZED`
- due user exists and send succeeds -> `{ ok: true, status: "sent", user_id, provider_message_id }`
- selected user but insufficient content -> `{ ok: true, status: "insufficient_content", user_id }`
- selected user but provider failure -> `{ ok: true, status: "send_failed", user_id }`
- no due user -> `{ ok: true, status: "no_due_user" }`
- DB function returns null user -> `{ ok: true, status: "no_due_user" }`
- already-sent-today path behaves as no due user
- boundary run timestamps around local-day rollover remain deterministic
- invalid payload -> `400 INVALID_PAYLOAD`
- malformed JSON body fallback (`{}`) path
- DB selector failure -> `500 INTERNAL_ERROR`
- pipeline internal error -> `500 INTERNAL_ERROR`
