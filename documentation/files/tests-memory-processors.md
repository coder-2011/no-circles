# File: `tests/memory-processors.test.ts`

## Purpose
Protects canonical memory contract behavior, structured JSON-op merge behavior, and fallback safety.

## Covered Cases
- required section headers are validated
- `800`-word cap enforcement
- onboarding fallback formatter returns canonical memory
- reply fallback formatter captures suppression signals and preserves canonical format
- structured model ops are applied deterministically to current memory
- invalid model JSON triggers deterministic fallback (no unsafe persistence)
- multi-reply updates are cumulative (later updates preserve prior active interests unless explicitly changed)
- suppress -> re-enable lifecycle works (topic is removed from suppressed and restored to active)
- conflicting model ops for the same topic are resolved deterministically (active list wins in current merge order)
- injection-like model output with extra keys is schema-rejected and falls back safely
- non-JSON instruction-like model output is parse-rejected and falls back safely
- warning logs expose rejection/fallback events for supervision

## Why These Tests Matter
- Ensures model-output format mistakes do not corrupt persisted memory.
- Prevents regressions where replies accidentally overwrite prior user context.
- Verifies contradictory-topic handling (`ACTIVE_INTERESTS` vs `SUPPRESSED_INTERESTS`) stays mutually consistent.
- Locks the core PR4 guarantee that fallback is safe and contract-compliant.
- Provides observable evidence (log events) when model output is suspicious or invalid.
