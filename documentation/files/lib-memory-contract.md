# File: `lib/memory/contract.ts`

## Purpose
Defines the canonical memory text structure and validation utilities.

## Canonical Headers
- `PERSONALITY`
- `ACTIVE_INTERESTS`
- `SUPPRESSED_INTERESTS`
- `RECENT_FEEDBACK`

## Constraints
- Hard cap: `800` words (`MEMORY_WORD_CAP`).
- All required headers must be present.

## Main Utilities
- `countWords`
- `hasRequiredHeaders`
- `parseSections`
- `formatSections`
- `enforceWordCap`
- `validateMemoryText`
