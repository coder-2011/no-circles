# File: `lib/memory/model-client.ts`

## Purpose
Wraps the Anthropic transport used by memory processing flows.

## Responsibilities
- load required Anthropic env vars for memory generation
- send message requests with separated system and user prompts
- detect auth failures distinctly via `ANTHROPIC_AUTH_ERROR`
- extract plain text from Anthropic response content blocks
- normalize invalid or empty response shapes into stable thrown error codes

## Notes
- This helper is transport-only; prompt building, retries, fallback behavior, and canonical-memory validation remain in `lib/memory/processors.ts`.
- Keeping HTTP concerns separate reduces mixing of network logic with memory-mutation logic.
