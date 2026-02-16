# File: `db/migrations/0006_gentle_summit.sql`

## Purpose
Adds PR9 delivery persistence primitives: per-user Bloom anti-repeat columns and outbound send idempotency table.

## Schema Changes
- `users` additions:
  - `sent_url_bloom_bits` (`text`, nullable base64 bitset)
- creates `outbound_send_idempotency`:
  - unique `idempotency_key`
  - `user_id` FK -> `users.id`
  - `local_issue_date`, `status`, `provider_message_id`, `failure_reason`, timestamps

## Indexes
- unique: `outbound_send_idempotency_key_unique`
- index: `outbound_send_idempotency_user_local_date_idx`
- index: `outbound_send_idempotency_status_idx`
