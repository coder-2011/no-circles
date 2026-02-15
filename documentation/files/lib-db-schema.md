# File: `lib/db/schema.ts`

## Purpose
Declares Drizzle table definitions and DB constraints for V1 minimal persistence.

## Tables
### `users`
- `id` UUID PK
- `email` text unique not null
- `timezone` text not null
- `send_time_local` text not null
- `interest_memory_text` text not null

### `newsletter_items`
- `id` UUID PK
- `user_id` UUID FK -> `users.id` (`ON DELETE CASCADE`)
- `url` text not null
- `title` text not null
- `sent_at` timestamptz not null default `now()`

## Indexes and Constraints
- unique index: `newsletter_items(user_id, url)` for anti-repeat behavior
- index: `newsletter_items(user_id, sent_at)` for per-user history scans
