# File: `app/api/onboarding/route.ts`

## Purpose
Handles onboarding persistence request for one user.

## Input Contract
Validated by `onboardingSchema` in `lib/schemas.ts`.

Required request keys:
- `preferred_name`
- `timezone`
- `send_time_local` (`HH:mm`, 24h)
- `brain_dump_text`

## Behavior
1. Parse JSON body.
2. Validate payload.
3. Resolve authenticated user email from auth session.
4. Return `401 UNAUTHORIZED` when session user is missing.
5. Transform `brain_dump_text` into canonical memory via onboarding processor.
6. Upsert row in `users` keyed by authenticated email.
7. Persist processor output to `interest_memory_text`.
7. Return `{ ok: true, user_id }`.

## Error Envelope
- `400` with `{ ok: false, error_code: "INVALID_PAYLOAD", ... }`
- `401` with `{ ok: false, error_code: "UNAUTHORIZED", ... }`
- `500` with `{ ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process onboarding memory." }` when memory processor fails
- `500` with `{ ok: false, error_code: "INTERNAL_ERROR", ... }`
