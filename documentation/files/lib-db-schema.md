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
- `last_reflection_at` timestamptz nullable (bi-daily memory-review cadence marker)
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
- `issue_variant` text not null default `daily` (`daily` | `welcome`)
- `status` text not null default `processing`
- `provider_message_id` text nullable
- `failure_reason` text nullable
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

### `user_email_history`
- `id` UUID PK
- `user_id` UUID FK -> `users.id` (`ON DELETE CASCADE`)
- `kind` text not null (`sent` | `reply`)
- `subject` text nullable
- `body_text` text not null
- `provider_message_id` text nullable
- `issue_variant` text nullable (`daily` | `welcome` for sent rows)
- `created_at` timestamptz not null default `now()`

### `admin_alert_state`
- `alert_key` text PK
- `kind` text not null (`error` | `digest` | `threshold`)
- `last_sent_at` timestamptz not null
- `send_count` integer not null default `1`
- `last_payload_hash` text nullable
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`
- RLS: enabled; `service_role` has full access, no authenticated-user policy

## Indexes and Constraints
- check constraint: `users_sent_url_bloom_bits_length_check` bounds `users.sent_url_bloom_bits` payload length
- index: `users_send_time_local_minute_idx` supports due-bucket filtering in cron selector SQL
- unique index: `processed_webhooks(provider, webhook_id)` for inbound idempotency
- index: `processed_webhooks(processed_at)` for retention pruning
- index: `cron_selection_leases(leased_at)` for lease visibility/cleanup scans
- unique index: `outbound_send_idempotency(idempotency_key)` for outbound send replay safety
- index: `outbound_send_idempotency(user_id, local_issue_date)` for per-user/per-day lookups
- index: `outbound_send_idempotency(status)` for operational visibility
- index: `user_email_history(user_id, kind, created_at)` for recent sent/reply evidence retrieval
- index: `admin_alert_state(kind)` for alert-kind filtering and cleanup
- index: `admin_alert_state(last_sent_at)` for cooldown and recency checks
