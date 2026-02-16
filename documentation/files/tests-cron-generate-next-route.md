# File: `tests/cron-generate-next-route.test.ts`

## Purpose
Protects cron selector route contract for authorization, due-user selection, and empty-queue behavior.

## Covered Cases
- unauthorized request -> `401 UNAUTHORIZED`
- wrong bearer token -> `401 UNAUTHORIZED`
- missing `CRON_SECRET` -> `401 UNAUTHORIZED`
- due user exists -> `{ ok: true, status: "selected", user_id }`
- no due user -> `{ ok: true, status: "no_due_user" }`
- DB function returns null user -> `{ ok: true, status: "no_due_user" }`
- already-sent-today path behaves as no due user
- boundary run timestamps around local-day rollover remain deterministic
- invalid payload -> `400 INVALID_PAYLOAD`
- malformed JSON body fallback (`{}`) path
- DB selector failure -> `500 INTERNAL_ERROR`
