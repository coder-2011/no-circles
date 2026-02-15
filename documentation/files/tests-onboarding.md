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

### Route tests
- invalid payload -> `400 INVALID_PAYLOAD`
- malformed JSON -> `400 INVALID_PAYLOAD`
- missing auth session -> `401 UNAUTHORIZED`
- success path -> returns `{ ok: true, user_id }` and uses upsert chain
- payload email spoofing ignored; authenticated session email is used
- DB error path -> `500 INTERNAL_ERROR`
