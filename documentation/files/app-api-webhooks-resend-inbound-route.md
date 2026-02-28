# File: `app/api/webhooks/resend/inbound/route.ts`

## Purpose
Processes inbound email replies from Resend and updates user memory exactly once per provider message.

## Request Requirements
- `Content-Type: application/json`
- Payload hard limit: `16KB`
- Svix signature headers:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`
- Raw JSON payload validated by `resendInboundWebhookSchema`.
- Environment variable: `RESEND_WEBHOOK_SECRET`.
- Environment variable: `RESEND_API_KEY` (used to fetch inbound email text by `email_id` when webhook payload omits inline text).

## Behavior
1. Reject non-JSON requests with `415 UNSUPPORTED_MEDIA_TYPE`.
2. Read raw request body (`request.text()`).
3. Reject oversized request bodies with `413 PAYLOAD_TOO_LARGE`.
4. Verify Svix signature from raw body.
5. Parse and validate payload.
6. Extract sender email from `data.from` (supports `Name <email>` format).
7. Resolve reply text:
   - use inline `data.text` when present
   - if missing and `data.email_id` exists, fetch message text from Resend (`emails.receiving.get`, fallback `emails.get`)
   - for fetched email content, extract newest reply segment and trim quoted-thread/history markers before memory merge
8. Ignore empty reply text after resolution.
9. Look up user by sender email.
10. If sender is unknown, send best-effort guidance auto-reply asking the user to reply from their subscribed email (using thread headers when available to suggest address), then return `ignored`.
11. Generate updated memory via reply processor.
12. In a DB transaction:
   - reserve idempotency key in `processed_webhooks` using `provider + message-id` when available
   - fallback to `provider + svix-id` only when provider message id is missing
   - skip when already processed
   - update `users.interest_memory_text` when newly reserved
   - insert one `reply` row into `user_email_history` with the extracted newest reply text and optional subject/provider id
13. Return `updated` or `ignored`.
14. `GET` returns `405 METHOD_NOT_ALLOWED` (route is not browser-navigable for processing).

## Security Logging
- Emits structured security events for:
  - missing signature headers
  - invalid signatures
  - invalid payload JSON/schema
  - replay ignores
  - unknown sender ignores
  - successful updates
  - internal processing errors

## Responses
- `200 { ok: true, status: "updated", user_id }`
- `200 { ok: true, status: "ignored" }`
- `413 PAYLOAD_TOO_LARGE`
- `415 UNSUPPORTED_MEDIA_TYPE`
- `401 INVALID_SIGNATURE`
- `400 INVALID_PAYLOAD`
- `500 INTERNAL_ERROR`
