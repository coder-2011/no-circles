# File: `tests/inbound-webhook-route.test.ts`

## Purpose
Validates inbound webhook route behavior for auth, idempotency, and one-time memory updates.

## Covered Cases
- invalid signature -> `401 INVALID_SIGNATURE`
- replayed fallback event key (`event:svix-id`) -> `{ ok: true, status: "ignored" }`
- replayed provider message id with different `svix-id` is still ignored (dedupe key remains `message:<id>`)
- obvious `noreply` sender -> `{ ok: true, status: "ignored" }` with no content fetch
- missing inline text with empty received-email content -> `{ ok: true, status: "ignored" }`
- inbound fetch path uses only `emails.receiving.get`
- blank `data.text` -> `{ ok: true, status: "ignored" }`
- valid signed payload with provider message id -> `{ ok: true, status: "updated", user_id }`
