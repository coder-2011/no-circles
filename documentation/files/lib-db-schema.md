# File: `lib/db/schema.ts`

## Purpose
Declares Drizzle table definitions and DB constraints for V1 minimal persistence.

## Tables
### `users`
- `id` UUID PK
- `email` text unique not null
- `preferred_name` text not null
- `timezone` text not null
- `send_time_local` text not null
- `interest_memory_text` text not null
- `last_issue_sent_at` timestamptz nullable (delivery-state authority for scheduler)

### `processed_webhooks`
- `id` UUID PK
- `provider` text not null
- `webhook_id` text not null
- `processed_at` timestamptz not null default `now()`

### `cron_selection_leases`
- `user_id` UUID PK/FK -> `users.id` (`ON DELETE CASCADE`)
- `leased_at` timestamptz not null default `now()`

## Indexes and Constraints
- unique index: `processed_webhooks(provider, webhook_id)` for inbound idempotency
- index: `processed_webhooks(processed_at)` for retention pruning
- index: `cron_selection_leases(leased_at)` for lease visibility/cleanup scans
