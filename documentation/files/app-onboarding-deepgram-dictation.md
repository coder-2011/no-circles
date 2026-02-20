# File: `app/onboarding/deepgram-dictation.ts`

## Purpose
Provides small pure helpers for onboarding live dictation through Deepgram.

## Responsibilities
- Build Deepgram live websocket URL with required listen parameters.
- Include explicit live model selection (`NEXT_PUBLIC_DEEPGRAM_MODEL`, default `nova-3`).
- Build tokenless websocket URL variant for subprotocol auth fallback.
- Parse Deepgram websocket events and classify result/error/ignore message types.
- Accumulate transcript state by `is_final` semantics (final chunks appended, interim kept separate).
- Downsample browser audio to mono 16k PCM (`linear16`) for live transcription.
- Compute packet sizing at ~200ms cadence for low-latency streaming.
- Convert `Int16Array` PCM samples to binary `ArrayBuffer` payloads sent over websocket.
- Merge final transcript text into the onboarding brain-dump field.

## Notes
- This file is client-only (`"use client"`).
- It intentionally avoids SDK usage in the browser and only handles transport-safe formatting helpers.
