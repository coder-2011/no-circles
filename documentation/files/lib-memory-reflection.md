# File: `lib/memory/reflection.ts`

## Purpose
Runs the bi-daily memory reflection review used by the daily send pipeline.

## Exports
- `shouldRunBiDailyReflection`
- `runBiDailyReflection`

## Behavior
- Gates reflection by issue variant and user-local 2-day cadence.
- Builds the reflection prompt from current canonical memory plus recent sent/reply email history.
- Calls Anthropic using `ANTHROPIC_REFLECTION_MODEL` with fallback to `ANTHROPIC_MEMORY_MODEL`.
- Validates model output with `memoryReflectionOutputSchema`.
- Validates rewritten memory with canonical memory rules.
- Falls back to `no_change` plus an empty discovery brief on model/schema/validation failure.

## Output
- `decision`: `no_change` or `rewrite`
- `memoryText`: reflected canonical memory or unchanged current memory
- `discoveryBrief`: ephemeral discovery steering for the current send
- `reviewedAt`: timestamp persisted to `users.last_reflection_at`
