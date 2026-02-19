# Subsystem: Ops Hardening (V1)

## Scope
Make runtime failures diagnosable, deterministic, and safe without changing product behavior.

## Goals
- centralize server environment validation
- standardize structured logs across routes and pipeline stages
- define explicit error classes and retry boundaries
- emit stable alert-ready events for operations

## Phase 1 (Easiest, Highest-Value Start): Centralized Env Validation

### What this means
Today, required env vars are checked in many places with different behavior (`throw`, `500`, or implicit failure).  
Centralized env validation means one shared module defines required variables and one consistent rule for handling missing config.

### Why this is first
- lowest architectural risk
- immediate reliability gain
- reduces hidden runtime failures and inconsistent error handling
- creates the foundation for clean logging and alerting

### Contract
1. A shared runtime env module is the single owner of required server env variables.
2. Every route/subsystem reads config through that module (not direct `process.env.*` checks).
3. Missing required env produces deterministic failure with stable `error_code`.
4. Failures are logged with subsystem + event + correlation/request id.

### Initial call sites to migrate
- `app/api/onboarding/route.ts`
- `app/api/cron/generate-next/route.ts`
- `app/api/webhooks/resend/inbound/route.ts`
- `lib/db/client.ts`
- `lib/discovery/tavily-client.ts`
- `lib/memory/processors.ts`
- `lib/summary/writer.ts`
- `lib/email/send-newsletter.ts`

## Phase 2: Structured Logging
- replace ad-hoc `console.*` string logs with stable JSON shape
- include: `timestamp`, `level`, `subsystem`, `event`, `request_id`
- attach context keys when available: `user_id`, `idempotency_key`, `error_code`, `duration_ms`

## Phase 3: Error Taxonomy + Retry Matrix
- classify failures into stable categories (`configuration`, `validation`, `auth`, `provider_transient`, `provider_permanent`, `db_transient`, `db_permanent`, `idempotency_conflict`)
- document retry/no-retry policy per class
- apply first to cron + send pipeline path

## Phase 4: Alert-Ready Operational Events
- emit stable events for failures:
  - `env.missing`
  - `cron.selection_failed`
  - `pipeline.send_failed`
  - `inbound.signature_invalid`
  - `idempotency.conflict`

## Non-Goals
- no feature redesign
- no scheduler throughput redesign in this subsystem
- no UI product changes unless needed for low-effort operator visibility
