# File: `lib/observability/log.ts`

## Purpose
Provides a shared structured logger used by runtime subsystems to emit consistent JSON log records.

## Log Shape
- `ts`: ISO timestamp
- `level`: `info` | `warn` | `error`
- `subsystem`: logical owner (for example `discovery`, `send_pipeline`)
- `event`: stable event name
- additional flat detail fields

## Behavior
- Serializes logs as JSON strings via `console.info`, `console.warn`, or `console.error`.
- Normalizes top-level `Error` objects to `{ name, message, stack }` for readable diagnostics.
- For every `logError(...)` call, lazily imports the admin alert path and forwards the event only when admin alerts are enabled and an admin email is configured. This keeps logger imports safe in test or local contexts where DB env is intentionally absent.
- Forwarded admin error emails are still subject to DB-backed dedupe/cooldown in `admin_alert_state`.
- Exposes helper functions:
  - `logEvent(...)`
  - `logInfo(...)`
  - `logWarn(...)`
  - `logError(...)`
