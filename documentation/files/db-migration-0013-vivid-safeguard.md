# File: `db/migrations/0013_vivid_safeguard.sql`

## Purpose
Enables PostgreSQL Row Level Security (RLS) on all active public runtime tables.

## Changes
- enables RLS on `users`
- enables RLS on `processed_webhooks`
- enables RLS on `cron_selection_leases`
- enables RLS on `outbound_send_idempotency`

## Rationale
- establishes table-level policy enforcement baseline before adding explicit row policies
- ensures client-role access is deny-by-default on these tables until policies are created
