# File: `lib/memory/processors.ts`

## Purpose
Builds onboarding/reply memory updates through a shared processing flow.

## Exports
- `formatOnboardingMemory(brainDumpText)`
- `mergeReplyIntoMemory(currentMemory, inboundReplyText)`
- `buildFallbackOnboardingMemory`
- `buildFallbackReplyMemory`

## Processing Strategy
1. Build prompt for the model (placeholder prompt builders for now).
2. Attempt model generation with one retry.
3. Validate against canonical memory contract.
4. Fall back to deterministic local formatter when model output is invalid/unavailable.

## Notes
- Keeps route handlers thin.
- Ensures memory structure remains stable for downstream topic derivation.
