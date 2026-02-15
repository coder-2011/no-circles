# Glossary

- `interest_memory_text`: per-user evolving text profile used to drive newsletter topic selection.
- `newsletter_items`: per-user sent-history table used to prevent repeated URLs.
- `upsert`: insert a row; if conflict key exists, update instead.
- `drizzle-kit`: migration CLI for generating and applying schema SQL changes.
- `migration journal`: drizzle metadata file tracking applied/generated migration entries.
- `session identity`: onboarding identity mode where authenticated session user email is used as the only trusted identity source.
- `next-env.d.ts`: Next.js-generated TypeScript reference file that can include route typing references from `.next/types`.
- `canonical memory text`: required sectioned format for `interest_memory_text` (`PERSONALITY`, `ACTIVE_INTERESTS`, `SUPPRESSED_INTERESTS`, `RECENT_FEEDBACK`).
- `svix-id`: webhook event identifier from signature headers used as inbound replay/idempotency key.
- `processed_webhooks`: replay-protection table storing processed webhook identifiers for one-time inbound updates.
- `idempotency`: processing guarantee where repeated delivery of the same event does not apply the same state mutation twice.
