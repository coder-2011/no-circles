# File: `lib/schemas.ts`

## Purpose
Defines zod validation for API boundaries.

## `onboardingSchema`
- Validates:
  - `preferred_name` non-empty
  - IANA timezone validity
  - `send_time_local` strict `HH:mm` 24h format
  - `brain_dump_text` length bounds
- Notes:
  - identity email is not accepted as trusted input; onboarding identity comes from authenticated session.

## `cronGenerateNextSchema`
- Optional `run_at_utc` ISO datetime string.

## `resendInboundWebhookSchema`
- Validates inbound webhook payload body shape:
  - `data.from` string
  - `data.text` optional string (defaults to empty)
