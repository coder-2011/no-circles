# File: `lib/feedback/click-token.ts`

## Purpose
Builds and verifies signed email click tokens for per-item preference feedback links.

## Exports
- `createFeedbackClickToken(...)`
- `verifyFeedbackClickToken(...)`
- `buildFeedbackClickUrl(...)`
- `resolveFeedbackBaseUrl()`
- `buildFeedbackEventId(...)`
- `FeedbackType` (`more_like_this` | `less_like_this`)

## Contract
- Token payload includes stable claims:
  - `uid` (user id)
  - `url` (item URL)
  - `title` (item title)
  - `ft` (feedback type)
  - `jti` (deterministic event id)
  - `exp` (expiry unix seconds)
- Tokens are HMAC SHA-256 signed with `FEEDBACK_LINK_SECRET`.
- Verification enforces:
  - signature match
  - payload shape/version
  - expiry window
  - deterministic `jti` integrity
- Default token TTL: 21 days.

## Notes
- `resolveFeedbackBaseUrl()` prefers `NEXT_PUBLIC_SITE_URL`, then `VERCEL_URL`.
- URL builder targets `GET /api/feedback/click` for email-safe one-click flows.
