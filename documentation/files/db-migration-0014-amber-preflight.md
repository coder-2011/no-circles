# File: `db/migrations/0014_amber_preflight.sql`

## Purpose
Opens scheduler due eligibility 3 minutes before each user's configured local send time so generation can finish before target inbox time.

## Changes
- replaces `public.claim_next_due_user(...)` due-time check to use:
  - current user-local minute bucket at `p_run_at_utc`
  - `greatest(send_time_local_minute - 3, 0)` as due threshold
- replaces `public.claim_due_users_batch(...)` due-time check with the same threshold logic
- preserves deterministic ordering, local-day exclusion, and lease TTL conflict behavior

## Rationale
- aligns selector timing with product requirement to start processing before nominal send time
- keeps single-user and batch selectors behaviorally consistent
- avoids prior-day sends for near-midnight preferences by clamping threshold at local `00:00`
