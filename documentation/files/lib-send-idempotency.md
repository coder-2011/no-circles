# File: `lib/send/idempotency.ts`

## Purpose
Handles outbound newsletter idempotency reservation/status updates for PR9.

## Exports
- `buildOutboundIdempotencyKey({ userId, timezone, runAtUtc })`
- `reserveOutboundSendIdempotency(...)`
- `markOutboundSendIdempotencySent(...)`
- `markOutboundSendIdempotencyFailed(...)`
- `getOutboundSendIdempotency(...)`

## Contract
- key format: `newsletter:v1:<user_id>:<local_issue_date>`
- one key per user per local date
- reserve result is typed:
  - `claimed` (new row inserted, proceed with send)
  - `retryable_failed_claimed` (existing `failed` row atomically reclaimed to `processing`, proceed with send)
  - `already_sent` (safe replay; pipeline returns `sent` without duplicate provider call)
  - `already_processing` (active in-flight send; pipeline must not report `sent`)
- reservation is computed in one SQL statement (insert + failed-reclaim + existing-status read), then runtime-validated before returning typed outcome
