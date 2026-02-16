# File: `lib/email/send-newsletter.ts`

## Purpose
Sends rendered newsletter email via Resend with immediate retry-once semantics.

## Input
- `to`, `subject`, `html`, `text`, `idempotencyKey`

## Behavior
- requires `RESEND_API_KEY`
- sends with configured `from` and optional `replyTo`
- includes outbound idempotency header (`x-newsletter-idempotency-key`)
- retry policy: max 2 attempts total (1 retry)
- returns normalized provider result (`ok`, `providerMessageId`, `attempts`, `error`)
