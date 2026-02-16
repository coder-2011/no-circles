# Files: `tests/onboarding-schema.test.ts`, `tests/onboarding-route.test.ts`

## Purpose
Protect onboarding input/route contract.

## Covered Cases
### Schema tests
- valid payload accepted
- optional extra payload email accepted (but not trusted for identity)
- invalid timezone rejected
- invalid time (`25:99`) rejected
- non-zero-padded time (`9:30`) rejected
- boundary time (`23:59`) accepted
- empty `brain_dump_text` rejected
- empty `preferred_name` rejected
- `preferred_name` is trimmed

### Route tests
- invalid payload -> `400 INVALID_PAYLOAD`
- malformed JSON -> `400 INVALID_PAYLOAD`
- missing auth session -> `401 UNAUTHORIZED`
- success path -> returns `{ ok: true, user_id }` and uses upsert chain
- payload email spoofing ignored; authenticated session email is used
- `preferred_name` is persisted and updated through onboarding upsert
- DB error path -> `500 INTERNAL_ERROR`
- onboarding memory processor failure -> `500 INTERNAL_ERROR`
- success path persists processor output (canonical memory), not raw `brain_dump_text`

### Additional PR3 tests
- `tests/memory-processors-core.test.ts`: canonical header validation, word-cap enforcement, onboarding/reply fallback generation
- `tests/inbound-webhook-route.test.ts`: signature rejection, replay ignore, blank reply ignore, valid one-time update
