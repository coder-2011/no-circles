# File: `lib/webhooks/resend-signature.ts`

## Purpose
Verifies inbound Resend webhook authenticity using Svix headers and raw request body.

## Inputs
- Raw body text
- Headers (`svix-id`, `svix-timestamp`, `svix-signature`)
- Shared secret (`RESEND_WEBHOOK_SECRET`)

## Behavior
- Computes expected HMAC signature for `{svix-id}.{svix-timestamp}.{rawBody}`.
- Parses one or many `v1` signatures from `svix-signature`.
- Uses timing-safe comparison.
