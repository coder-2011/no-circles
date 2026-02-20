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
- `send_time_local_minute` generated integer bucket from `send_time_local` (`0..1439`) for scheduler selection
- `interest_memory_text` text not null
- `last_issue_sent_at` timestamptz nullable (delivery-state authority for scheduler)
- `sent_url_bloom_bits` text nullable (base64-encoded Bloom bitset)

### `processed_webhooks`
- `id` UUID PK
- `provider` text not null
- `webhook_id` text not null
- `processed_at` timestamptz not null default `now()`

### `cron_selection_leases`
- `user_id` UUID PK/FK -> `users.id` (`ON DELETE CASCADE`)
- `leased_at` timestamptz not null default `now()`

### `outbound_send_idempotency`
- `id` UUID PK
- `idempotency_key` text not null (unique)
- `user_id` UUID FK -> `users.id` (`ON DELETE CASCADE`)
- `local_issue_date` date not null
- `status` text not null default `processing`
- `provider_message_id` text nullable
- `failure_reason` text nullable
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

## Indexes and Constraints
- check constraint: `users_sent_url_bloom_bits_length_check` bounds `users.sent_url_bloom_bits` payload length
- index: `users_send_time_local_minute_idx` supports due-bucket filtering in cron selector SQL
- unique index: `processed_webhooks(provider, webhook_id)` for inbound idempotency
- index: `processed_webhooks(processed_at)` for retention pruning
- index: `cron_selection_leases(leased_at)` for lease visibility/cleanup scans
- unique index: `outbound_send_idempotency(idempotency_key)` for outbound send replay safety
- index: `outbound_send_idempotency(user_id, local_issue_date)` for per-user/per-day lookups
- index: `outbound_send_idempotency(status)` for operational visibility
