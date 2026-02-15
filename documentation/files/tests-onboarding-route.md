# File: `tests/onboarding-route.test.ts`

## Purpose
Route-level contract tests for `POST /api/onboarding`.

## Covered Cases
- invalid payload returns `400 INVALID_PAYLOAD`
- malformed JSON returns `400 INVALID_PAYLOAD`
- missing session identity returns `401 UNAUTHORIZED`
- success path returns `{ ok: true, user_id }`
- spoofed payload email is ignored in favor of authenticated session email
- database write failure returns `500 INTERNAL_ERROR`
- onboarding memory processor failure returns `500 INTERNAL_ERROR`
- success persists processed canonical memory (not raw `brain_dump_text`)

## Why It Exists
- Guards auth trust boundary and onboarding persistence contract.
- Prevents regressions where raw onboarding text bypasses memory processing.
