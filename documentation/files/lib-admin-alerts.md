# File: `lib/admin/alerts.ts`

## Purpose
Implements admin-only alert delivery with DB-backed dedupe.

## Responsibilities
- reads admin alert configuration from env
- builds stable alert keys for errors, threshold warnings, and daily digests
- suppresses duplicate emails for the same alert during a cooldown window
- sends admin emails through `sendTransactionalEmail(...)`

## Key Behaviors
- `notifyAdminOfError(...)`
  - called indirectly by the shared logger for every `error`-level event
  - skips recursive re-alerting for `admin_alert` failures
- `sendThresholdAlert(...)`
  - sends provider warning/error emails from the admin monitor job
- `sendDailyDigest(...)`
  - sends the once-daily provider health report

## Persistence
- uses `admin_alert_state` only for dedupe/cooldown memory
- does not store full daily summaries or provider analytics history

## Separation Guarantee
- admin emails are sent with `sendTransactionalEmail(...)`
- they do not reuse newsletter idempotency records or the normal user send pipeline
