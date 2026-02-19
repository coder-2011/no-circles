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
- Exposes helper functions:
  - `logEvent(...)`
  - `logInfo(...)`
  - `logWarn(...)`
  - `logError(...)`
