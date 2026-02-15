# File: `tests/inbound-webhook-route.test.ts`

## Purpose
Validates inbound webhook route behavior for auth, idempotency, and one-time memory updates.

## Covered Cases
- invalid signature -> `401 INVALID_SIGNATURE`
- replayed `svix-id` -> `{ ok: true, status: "ignored" }`
- blank `data.text` -> `{ ok: true, status: "ignored" }`
- valid signed payload -> `{ ok: true, status: "updated", user_id }`
