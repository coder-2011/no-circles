# Glossary

- `interest_memory_text`: per-user evolving text profile used to drive newsletter topic selection.
- `newsletter_items`: per-user sent-history table used to prevent repeated URLs.
- `upsert`: insert a row; if conflict key exists, update instead.
- `drizzle-kit`: migration CLI for generating and applying schema SQL changes.
- `migration journal`: drizzle metadata file tracking applied/generated migration entries.
- `session identity`: onboarding identity mode where authenticated session user email is used as the only trusted identity source.
