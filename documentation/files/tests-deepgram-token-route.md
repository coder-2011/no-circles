# File: `tests/deepgram-token-route.test.ts`

## Purpose
Verifies the Deepgram token issuance route behavior and failure handling.

## Coverage
- unauthenticated request -> `401 UNAUTHORIZED`
- missing `DEEPGRAM_API_KEY` -> `500 MISSING_CONFIG`
- successful grant -> `200` with `{ access_token, expires_in }`
- Deepgram grant failure -> `502 DEEPGRAM_TOKEN_FAILED`

## Notes
- Mocks both server auth helper and `@deepgram/sdk` `createClient().auth.grantToken()` so tests remain deterministic and do not call external services.
