# File: `lib/memory/contract.ts`

## Purpose
Defines the canonical memory text structure and validation utilities.

## Canonical Headers
- `PERSONALITY`
- `ACTIVE_INTERESTS`
- `RECENT_FEEDBACK`

## Constraints
- Hard cap: `800` words (`MEMORY_WORD_CAP`).
- All required headers must be present.
- Local implementation reads both:
  - current 3-header canonical shape
  - legacy 4-header shape containing `SUPPRESSED_INTERESTS`
- `parseSections(...)` normalizes both shapes into the current 3-section runtime view.

## Main Utilities
- `countWords`
- `hasRequiredHeaders`
- `parseSections`
- `formatSections`
- `enforceWordCap`
- `validateMemoryText`
