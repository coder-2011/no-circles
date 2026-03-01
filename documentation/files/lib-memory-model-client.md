# File: `lib/memory/model-client.ts`

## Purpose
Wraps the shared Anthropic-compatible transport used by memory processing flows.

## Responsibilities
- resolve memory-model envs with OpenRouter-first fallback:
  - `OPENROUTER_MEMORY_MODEL`
  - `ANTHROPIC_MEMORY_MODEL`
- call the shared Anthropic-compatible text-model client
- detect auth failures distinctly via `ANTHROPIC_AUTH_ERROR`
- keep existing memory-specific error codes stable (`MISSING_ANTHROPIC_*`, `ANTHROPIC_HTTP_*`) for low-churn migration

## Notes
- This helper is transport-only; prompt building, retries, fallback behavior, and canonical-memory validation remain in `lib/memory/processors.ts`.
- Keeping HTTP concerns separate reduces mixing of network logic with memory-mutation logic.
