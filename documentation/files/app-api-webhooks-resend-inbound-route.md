# File: `app/api/webhooks/resend/inbound/route.ts`

## Purpose
Processes inbound email replies from Resend and updates user memory exactly once per webhook event.

## Request Requirements
- Svix signature headers:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`
- Raw JSON payload validated by `resendInboundWebhookSchema`.
- Environment variable: `RESEND_WEBHOOK_SECRET`.

## Behavior
1. Read raw request body (`request.text()`).
2. Verify Svix signature from raw body.
3. Parse and validate payload.
4. Extract sender email from `data.from` (supports `Name <email>` format).
5. Ignore empty reply text.
6. Look up user by sender email.
7. Generate updated memory via reply processor.
8. In a DB transaction:
   - reserve idempotency key in `processed_webhooks` using `provider + svix-id`
   - skip when already processed
   - update `users.interest_memory_text` when newly reserved
9. Return `updated` or `ignored`.

## Responses
- `200 { ok: true, status: "updated", user_id }`
- `200 { ok: true, status: "ignored" }`
- `401 INVALID_SIGNATURE`
- `400 INVALID_PAYLOAD`
- `500 INTERNAL_ERROR`
