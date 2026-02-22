# File: `db/migrations/0015_sure_policy.sql`

## Purpose
Adds explicit row-level security policies so enabled RLS no longer blocks runtime access.

## Changes
- keeps RLS enabled on all active runtime tables:
  - `users`
  - `processed_webhooks`
  - `cron_selection_leases`
  - `outbound_send_idempotency`
- adds `service_role` full-access policies (`FOR ALL`) on each runtime table.
- adds authenticated self-access policies on `users` keyed by JWT email:
  - select own row
  - update own row (with matching `WITH CHECK`)

## Rationale
- migration `0013_vivid_safeguard.sql` enabled RLS with deny-by-default posture.
- without explicit policies, RLS can block expected app behavior.
- this migration makes access rules explicit and reproducible in source control rather than dashboard-only state.
