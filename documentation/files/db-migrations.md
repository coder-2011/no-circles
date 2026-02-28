# Files: `db/migrations/*`

## Purpose
Versioned SQL history for database schema state.

## Current Migration
- `db/migrations/0000_sour_butterfly.sql`
  - creates `users`
  - creates `newsletter_items`
  - adds FK + indexes + unique constraints
- `db/migrations/0001_sturdy_ion.sql`
  - creates `processed_webhooks`
  - adds unique index on `(provider, webhook_id)` for inbound idempotency
  - adds `processed_at` index for 30-day retention pruning
- `db/migrations/0002_mellow_orchid.sql`
  - adds `users.preferred_name`
  - backfills existing users from email local-part
  - enforces `NOT NULL` after backfill
- `db/migrations/0003_misty_calm.sql`
  - adds nullable `users.last_issue_sent_at`
  - establishes scheduler delivery-state authority on `users` (not `newsletter_items`)
- `db/migrations/0004_steady_spark.sql`
  - creates `cron_selection_leases`
  - adds 5-minute duplicate-trigger lease persistence primitive for scheduler selection
  - creates `public.claim_next_due_user(run_at_utc, lease_ttl_minutes)` DB function as scheduler logic owner
- `db/migrations/0005_quiet_harbor.sql`
  - drops `newsletter_items`
  - finalizes Bloom-filter-first anti-repeat direction by removing row-per-link history table
- `db/migrations/0006_gentle_summit.sql`
  - adds per-user Bloom persistence columns on `users`
  - creates `outbound_send_idempotency` table for per-user/local-date outbound replay safety
- `db/migrations/0007_calm_guardrail.sql`
  - adds `users_sent_url_bloom_bits_length_check` constraint to bound persisted Bloom bitset payload size
- `db/migrations/0008_swift_current.sql`
  - adds `public.claim_due_users_batch(run_at_utc, lease_ttl_minutes, batch_size)`
  - introduces deterministic multi-user lease claiming for each cron invocation
- `db/migrations/0009_crisp_bucket.sql`
  - adds generated `users.send_time_local_minute` due bucket column
  - adds `users_send_time_local_minute_idx` index
  - updates `public.claim_due_users_batch(...)` to compare local-minute values against the precomputed bucket
- `db/migrations/0010_calm_lockstep.sql`
  - rewrites `public.claim_due_users_batch(...)` CTE shape to separate row locking from ranking
  - preserves deterministic batch ordering while avoiding PostgreSQL `FOR UPDATE` + window-function restriction
- `db/migrations/0011_clear_output.sql`
  - qualifies `RETURNING public.cron_selection_leases.user_id` in lease upsert CTE
  - removes ambiguous `user_id` reference during batch claim execution
- `db/migrations/0012_steady_signal.sql`
  - updates batch upsert conflict target to `ON CONFLICT ON CONSTRAINT cron_selection_leases_pkey`
  - aliases lease CTE output as `leased_user_id` to avoid PL/pgSQL output-variable ambiguity
- `db/migrations/0013_vivid_safeguard.sql`
  - enables row level security on all active public runtime tables (`users`, `processed_webhooks`, `cron_selection_leases`, `outbound_send_idempotency`)
  - sets deny-by-default access posture until explicit table policies are created
- `db/migrations/0014_amber_preflight.sql`
  - updates `public.claim_next_due_user(...)` to start due eligibility 3 minutes before configured local send time (clamped at local midnight)
  - updates `public.claim_due_users_batch(...)` with the same 3-minute pre-send eligibility window to keep selector behavior consistent across single/batch entry points
- `db/migrations/0015_sure_policy.sql`
  - creates explicit RLS policies for all active runtime tables
  - grants `service_role` full table access under RLS
  - grants authenticated self select/update access on `users` via JWT email match
- `db/migrations/0016_firm_scope.sql`
  - pins `search_path = public` on `public.claim_next_due_user(...)` and `public.claim_due_users_batch(...)`
  - rewrites authenticated `users` self-access policies to use initplan-friendly `(select auth.jwt() ->> 'email')`
  - preserves existing scheduler and self-access behavior while resolving Supabase linter warnings

## Metadata
- `db/migrations/meta/_journal.json`: migration journal
- `db/migrations/meta/0000_snapshot.json`: schema snapshot used by drizzle-kit
- `db/migrations/meta/0001_snapshot.json`: schema snapshot after inbound idempotency table addition
- `db/migrations/meta/0002_snapshot.json`: schema snapshot after preferred-name persistence migration

## Direction Note
- Anti-repeat authority is per-user Bloom filter state.
- `newsletter_items` was removed in `0005_quiet_harbor`.
- Outbound send idempotency authority is `outbound_send_idempotency.idempotency_key`.
