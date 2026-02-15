# File: `lib/webhooks/inbound-idempotency.ts`

## Purpose
Utility helpers for inbound webhook idempotency and retention cleanup.

## Exports
- `reserveWebhookEvent(provider, webhookId)`
- `pruneProcessedWebhooksOlderThan(days)`

## Contract
- `processed_webhooks(provider, webhook_id)` is unique.
- Reserving a duplicate key indicates replay/already-processed event.
