# File: `lib/memory/email-history.ts`

## Purpose
Stores and loads the last 5 sent emails and last 5 reply emails per user for the bi-daily reflection subsystem.

## Exports
- `RECENT_EMAIL_HISTORY_LIMIT`
- `recordRecentEmailHistory`
- `loadRecentEmailHistory`

## Behavior
- Writes plain-text email evidence into `user_email_history`.
- Supports two kinds of evidence:
  - `sent`
  - `reply`
- Normalizes body text to trimmed newline-normalized plain text.
- Prunes older rows after each insert so only the latest 5 rows remain per `user_id + kind`.
- Loads recent sent and reply windows separately and returns both together.

## Notes
- This module stores recent raw evidence only.
- It does not mutate canonical memory and does not call the reflection model.
