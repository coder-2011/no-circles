# File: `tests/onboarding-deepgram-dictation.test.ts`

## Purpose
Covers pure helper behavior used by onboarding Deepgram dictation runtime.

## Coverage
- Deepgram websocket URL construction with token + listen query params.
- Model override behavior for websocket URL construction.
- Transcript append behavior for empty/non-empty inputs.
- Deepgram websocket message parsing for `Results` and `Error` payloads.
- Transcript state progression across interim and final chunks (`is_final` semantics).
- Packet-size calculation at ~200ms cadence.
- Audio conversion path: downsample 48k input to 16k and convert to binary linear16 bytes.

## Why It Exists
- Gives fast regression coverage for the highest-risk client dictation conversion logic without flaky browser audio integration tests.
