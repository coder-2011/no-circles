# File: `lib/memory/processors.ts`

## Purpose
Builds onboarding/reply memory updates through a shared processing flow.

## Exports
- `formatOnboardingMemory(brainDumpText)`
- `mergeReplyIntoMemory(currentMemory, inboundReplyText)`
- `buildFallbackOnboardingMemory`
- `buildFallbackReplyMemory`

## Processing Strategy
1. Build onboarding/reply prompt text from `lib/ai/memory-prompts.ts`.
2. Attempt model generation with one retry.
3. For reply updates, require structured JSON ops validated by `memoryUpdateOpsSchema`.
4. Apply deterministic merge rules in code, including active-interest lane transitions (`core` vs `side`) inferred by the model ops.
5. Encode lane state inside `ACTIVE_INTERESTS` bullets: plain `- topic` = core, `- [side] topic` = side.
6. Fall back to deterministic local formatter when model output is invalid/unavailable.
7. Reply fallback is non-destructive: preserve existing `PERSONALITY`, `ACTIVE_INTERESTS`, and `SUPPRESSED_INTERESTS`, and append the new reply to `RECENT_FEEDBACK`.
8. Normalize canonical memory topic lines (split merged topic bullets and remove active/suppressed overlaps).
9. Reuse shared lane parser from `lib/memory/active-interest-lanes.ts` to keep lane semantics aligned with discovery.

## Observability (Lightweight)
- Emits structured JSON logs to stdout/stderr for model and fallback outcomes.
- Current events:
  - `onboarding_model_success`
  - `onboarding_model_invalid_output`
  - `onboarding_model_error`
  - `onboarding_fallback_used`
  - `reply_model_success`
  - `reply_model_schema_invalid`
  - `reply_model_merge_invalid`
  - `reply_model_error`
  - `reply_fallback_used`
- Goal: keep telemetry minimal while making fallback reasons measurable.

## Notes
- Keeps route handlers thin.
- Ensures memory structure remains stable for downstream topic derivation.
- Model provider: Anthropic Messages API.
- Required envs: `ANTHROPIC_API_KEY` and `ANTHROPIC_MEMORY_MODEL`.
- On `401/403` from Anthropic, onboarding path raises `ANTHROPIC_AUTH_FAILED` (no retry fallback).
