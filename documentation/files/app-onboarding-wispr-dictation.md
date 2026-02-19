# File: `app/onboarding/wispr-dictation.ts`

## Purpose
Holds small, reusable helpers for onboarding voice dictation with Wispr Flow.

## Key Responsibilities
- Build Wispr warmup and websocket URLs from optional public env overrides.
- Read public client config (`NEXT_PUBLIC_WISPR_CLIENT_KEY`, `NEXT_PUBLIC_WISPR_ACCESS_TOKEN`).
- Merge final transcript text into the existing brain-dump draft.
- Downsample microphone audio to mono 16k PCM and encode it as base64 WAV packets for websocket `append` messages.

## Notes
- Keeps dictation formatting and encoding logic out of the onboarding controller to keep UI state logic simpler.
- Uses browser-safe base64 encoding with a Node Buffer fallback for tests.
