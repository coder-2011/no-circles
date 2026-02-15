# File: `lib/schemas.ts`

## Purpose
Defines zod validation for API boundaries.

## `onboardingSchema`
- Validates:
  - `email` format
  - `preferred_name` non-empty
  - IANA timezone validity
  - `send_time_local` strict `HH:mm` 24h format
  - `brain_dump_text` length bounds

## `cronGenerateNextSchema`
- Optional `run_at_utc` ISO datetime string.
