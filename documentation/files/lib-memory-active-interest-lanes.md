# File: `lib/memory/active-interest-lanes.ts`

## Purpose
Provides a shared parser for lane-aware active interests so memory merge and discovery use identical interpretation rules.

## Export
- `parseActiveInterestLanes(section)`

## Behavior
1. Reads `ACTIVE_INTERESTS` bullet lines.
2. Treats plain bullets as core lane topics.
3. Treats `[side] topic` bullets as side lane topics.
4. Accepts optional `[core] topic` marker and resolves duplicate lane conflicts with core precedence.
5. Splits compound topic lines consistently and de-duplicates case-insensitively while preserving first-seen order.

## Why It Exists
- Prevents parser drift between `lib/memory/processors.ts` and `lib/discovery/topic-derivation.ts`.
- Keeps lane semantics deterministic across reply updates and topic selection.
