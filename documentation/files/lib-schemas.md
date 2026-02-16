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
  - optional provider message identity (`data.email_id`, `data.message_id`, `data.id`)
  - `data.from` string
  - `data.text` optional string (defaults to empty)
  - optional `data.headers` key-value map (for header-level `message-id` extraction)

## `memoryUpdateOpsSchema`
- Validates structured reply-memory update operations from the model.
- Strict keys only:
  - `add_active`, `add_suppressed`, `remove_active`, `remove_suppressed`
  - `personality_add`, `personality_remove`
  - `recent_feedback_add`
- All fields are bounded arrays with safe string length limits and defaults.
