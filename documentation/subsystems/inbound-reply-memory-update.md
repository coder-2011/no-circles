# Subsystem: Inbound Reply Memory Update

## Scope
Implements PR3 memory processing and inbound webhook update safety:
- canonical memory contract and cap enforcement
- onboarding memory processing path
- inbound reply webhook verification and update path
- replay-safe idempotency storage and retention cleanup

## Current Implementation
- Inbound route: `app/api/webhooks/resend/inbound/route.ts`
- Onboarding route integration: `app/api/onboarding/route.ts`
- Memory contract: `lib/memory/contract.ts`
- Memory processors: `lib/memory/processors.ts`
- Prompt scaffolding: `lib/ai/memory-prompts.ts`
- Signature helper: `lib/webhooks/resend-signature.ts`
- Idempotency helper: `lib/webhooks/inbound-idempotency.ts`
- Prune script: `scripts/prune-inbound-idempotency.ts`
- Tests: `tests/memory-processors-core.test.ts`, `tests/memory-processors-reply-merge.test.ts`, `tests/inbound-webhook-route.test.ts`, `tests/onboarding-route.test.ts`

## Runtime Contract
1. Onboarding flow sends `brain_dump_text` into onboarding memory processor.
2. Processor returns canonical memory text with required headers and max 800-word cap.
3. Route persists processor output to `users.interest_memory_text`.
4. Inbound route receives signed Resend webhook and verifies Svix signature from raw body.
5. Route extracts sender email from `data.from` and text from `data.text`.
6. Unknown sender or empty text returns `{ ok: true, status: "ignored" }`.
7. Valid events reserve idempotency key in `processed_webhooks` using provider message id when present (`provider + message:*`), else fallback event id (`provider + event:svix-id`).
8. If key already exists, route returns `{ ok: true, status: "ignored" }`.
9. If key is new, route updates `users.interest_memory_text` once and returns `updated`.
10. Reply memory update path expects model JSON ops, validates via zod, applies deterministic merge rules, and falls back on invalid/unavailable model outputs.

## Operational Notes
- Memory processor emits lightweight structured logs for model success/failure/schema-invalid/fallback events.
- This keeps fallback behavior measurable without introducing heavy observability infrastructure.

## Data Model in Scope
- `users.interest_memory_text`
- `processed_webhooks`:
  - `id`
  - `provider`
  - `webhook_id`
  - `processed_at`
- Constraints:
  - unique `(provider, webhook_id)`
  - index `(processed_at)` for cleanup

## Retention Policy
- `processed_webhooks` rows older than 30 days are pruned by `scripts/prune-inbound-idempotency.ts`.
