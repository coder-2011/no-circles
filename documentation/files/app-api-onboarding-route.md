# File: `app/api/onboarding/route.ts`

## Purpose
Handles onboarding persistence request for one user.

## Input Contract
Validated by `onboardingSchema` in `lib/schemas.ts`.
- Requires `Content-Type: application/json`.
- Payload hard limit: `64KB`.

Required request keys:
- `preferred_name`
- `timezone`
- `send_time_local` (`HH:mm`, 24h)
- `brain_dump_text`

## Behavior
1. Reject non-JSON requests with `415 UNSUPPORTED_MEDIA_TYPE`.
2. Reject oversized request bodies with `413 PAYLOAD_TOO_LARGE`.
3. Parse JSON body.
4. Validate payload.
5. Resolve authenticated user email from auth session.
6. Return `401 UNAUTHORIZED` when session user is missing.
7. Transform `brain_dump_text` into canonical memory via onboarding processor.
8. Upsert row in `users` keyed by authenticated email.
9. Persist `preferred_name` to `users.preferred_name`.
10. Persist processor output to `interest_memory_text`.
11. If this upsert is a first insert (`xmax = 0`), schedule immediate welcome issue send (`5` items, `welcome` variant) via `after(...)` so work is attached to request lifecycle in serverless runtimes.
12. Return `{ ok: true, user_id }`.

## Error Envelope
- `413` with `{ ok: false, error_code: "PAYLOAD_TOO_LARGE", ... }`
- `415` with `{ ok: false, error_code: "UNSUPPORTED_MEDIA_TYPE", ... }`
- `400` with `{ ok: false, error_code: "INVALID_PAYLOAD", ... }`
- `401` with `{ ok: false, error_code: "UNAUTHORIZED", ... }`
- `500` with `{ ok: false, error_code: "MODEL_AUTH_ERROR", message: "Anthropic authentication failed. Check server API key env and restart dev server." }` when Anthropic returns auth failure
- `500` with `{ ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process onboarding memory." }` when memory processor fails
- `500` with `{ ok: false, error_code: "INTERNAL_ERROR", ... }`
