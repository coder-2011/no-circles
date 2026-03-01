# File: `db/migrations/0019_solid_initplan.sql`

## Purpose
Eliminates Supabase RLS initplan warnings for authenticated self-access policies.

## Changes
- creates or replaces `public.current_auth_email()`
- pins the helper function `search_path` to `public`
- recreates `users_authenticated_select_self_by_email`
- recreates `users_authenticated_update_self_by_email`
- recreates `user_email_history_authenticated_select_self`
- routes all three policies through `(select public.current_auth_email())`

## Why It Exists
Some environments still surface Supabase linter warnings for per-row `auth.jwt()` evaluation in RLS policies. This migration makes the JWT-email lookup explicit and reusable, then reapplies the relevant policies in a form that is easier for Postgres to cache and for the linter to recognize as initplan-friendly.
