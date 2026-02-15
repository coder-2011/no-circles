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
4. Apply deterministic merge rules in code, then validate canonical memory contract.
5. Fall back to deterministic local formatter when model output is invalid/unavailable.

## Notes
- Keeps route handlers thin.
- Ensures memory structure remains stable for downstream topic derivation.
- Model provider: Anthropic Messages API.
- Required env: `ANTHROPIC_API_KEY`.
- Optional env override: `ANTHROPIC_MEMORY_MODEL` (default: `claude-3-5-sonnet-20240620`).
