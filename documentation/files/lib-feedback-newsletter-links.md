# File: `lib/feedback/newsletter-links.ts`

## Purpose
Builds per-item `more_like_this` / `less_like_this` email feedback links for rendered newsletters.

## Responsibilities
- accept selected newsletter summary items plus `userId`
- detect when feedback-link generation is disabled because signing config is missing
- create signed click tokens for both feedback directions per item
- return the `feedbackLinksByItemUrl` map expected by the newsletter renderer

## Notes
- The helper is pure with respect to logging; callers decide whether disabled-config states should emit logs.
- This keeps send-pipeline render assembly thinner without changing token or URL construction behavior.
