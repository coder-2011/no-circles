# File: `db/migrations/0016_firm_scope.sql`

## Purpose
Hardens scheduler DB functions and authenticated self-access policies without changing product behavior.

## Changes
- recreates `public.claim_next_due_user(...)` with `SET search_path = public`
- recreates `public.claim_due_users_batch(...)` with `SET search_path = public`
- recreates authenticated `users` self-access policies using initplan-friendly JWT email reads:
  - `users_authenticated_select_self_by_email`
  - `users_authenticated_update_self_by_email`

## Rationale
- fixes Supabase DB linter security warnings for mutable function `search_path`
- fixes Supabase DB linter performance warnings for per-row `auth.jwt()` evaluation in RLS policies
- keeps current scheduler ordering, due-window logic, lease semantics, and self-email-match authorization behavior unchanged
