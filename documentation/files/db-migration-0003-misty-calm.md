# File: `db/migrations/0003_misty_calm.sql`

## Purpose
Adds scheduler delivery-state timestamp to users.

## Schema Changes
- adds nullable `users.last_issue_sent_at` (`timestamptz`)

## Why It Exists
- PR5 scheduler selection uses `users.last_issue_sent_at` to enforce "already sent today" exclusion by local day.
- decouples scheduler delivery-state tracking from `newsletter_items` content history.
