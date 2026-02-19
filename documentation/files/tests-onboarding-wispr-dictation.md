# File: `tests/onboarding-wispr-dictation.test.ts`

## Purpose
Validates the onboarding Wispr dictation helper primitives.

## Coverage
- Websocket URL generation with encoded Bearer client key.
- Transcript merge behavior for append/empty cases.
- Audio downsampling (48k -> 16k) and WAV/base64 encoding shape sanity.

## Why It Exists
- Keeps the dictation MVP safe without requiring brittle browser-mic integration tests.
- Verifies the highest-risk pure logic used by the onboarding controller.
