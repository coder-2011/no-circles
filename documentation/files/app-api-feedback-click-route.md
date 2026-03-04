# File: `app/api/feedback/click/route.ts`

## Purpose
Handles signed email click feedback (`More like this` / `Less like this`) with idempotent processing and direct memory append.

## Endpoint
- `GET /api/feedback/click?token=...`

## Behavior
1. Validates `FEEDBACK_LINK_SECRET` config.
2. Verifies signed token claims and expiry.
3. Reserves idempotency key in `processed_webhooks` using provider `feedback_click` + token `jti`.
4. If duplicate, returns `200` with no-op confirmation HTML.
5. If new event, locks user row (`FOR UPDATE`) in transaction, appends one line to `RECENT_FEEDBACK`, updates `users.interest_memory_text`, and returns `200` confirmation HTML.
6. Confirmation page always attempts `window.close()` / `history.back()` on load instead of limiting that behavior to desktop pointers.
7. For `more_like_this`, the page also auto-continues to the original article URL after a short delay if the tab/webview remains open.
8. For `less_like_this`, the page stays on confirmation by default but exposes a direct `Read article anyway` action using the token URL.

## Memory Append Format
- `+ [more_like_this] <title>`
- `- [less_like_this] <title>`

## Failure Modes
- Invalid/missing token -> `400`
- Missing secret config -> `500`
- Missing user -> `404`
- Processing failure -> `500`
