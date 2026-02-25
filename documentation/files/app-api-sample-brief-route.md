# File: `app/api/sample-brief/route.ts`

## Purpose
Returns homepage sample brief content by reusing the latest sent newsletter text for a fixed source account.

## Source Account
- Hardcoded source email preference order:
  - `naman.chetwani@gmail.com`
  - `naman.chatwani@gmail.com`
  - `naman.chitwani@gmail.com`

## Behavior
1. Resolves source user by email from `users`.
2. Finds newest successful outbound send with a non-null `provider_message_id`.
3. Fetches provider email text via Resend `emails.get`.
4. Parses text into `{ title, url, summary }[]` using `parseNewsletterText`.
5. Returns parsed sample content for homepage rendering.

## Responses
- `200`: `{ ok: true, source_email, local_issue_date, provider_message_id, items, quote }`
- `404 SOURCE_USER_NOT_FOUND`
- `404 SOURCE_BRIEF_NOT_FOUND`
- `422 SOURCE_BRIEF_PARSE_FAILED`
- `502 PROVIDER_FETCH_FAILED`
- `500 INTERNAL_ERROR`
