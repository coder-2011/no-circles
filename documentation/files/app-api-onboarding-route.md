# File: `app/api/onboarding/route.ts`

## Purpose
Handles onboarding persistence request for one user.

## Input Contract
Validated by `onboardingSchema` in `lib/schemas.ts`.

Required request keys:
- `email`
- `preferred_name`
- `timezone`
- `send_time_local` (`HH:mm`, 24h)
- `brain_dump_text`

## Behavior
1. Parse JSON body.
2. Validate payload.
3. Upsert row in `users` keyed by `email`.
4. Set `interest_memory_text = brain_dump_text`.
5. Return `{ ok: true, user_id }`.

## Error Envelope
- `400` with `{ ok: false, error_code: "INVALID_PAYLOAD", ... }`
- `500` with `{ ok: false, error_code: "INTERNAL_ERROR", ... }`
