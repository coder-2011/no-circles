# File: `app/api/deepgram/token/route.ts`

## Purpose
Issues a short-lived Deepgram access token for authenticated frontend dictation sessions.

## Behavior
1. Requires a valid signed-in user session via server auth helper.
2. Requires server env `DEEPGRAM_API_KEY`.
3. Calls Deepgram REST `POST /v1/auth/grant` with `Authorization: Token <DEEPGRAM_API_KEY>`.
4. Returns `{ ok: true, access_token, expires_in }` with `Cache-Control: no-store`.

## Error Cases
- `401 UNAUTHORIZED` when no authenticated user.
- `500 MISSING_CONFIG` when `DEEPGRAM_API_KEY` is missing.
- `502 DEEPGRAM_TOKEN_FAILED` when Deepgram token grant fails.
- `500 INTERNAL_ERROR` on unexpected failures.
