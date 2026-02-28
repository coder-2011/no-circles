CREATE OR REPLACE FUNCTION "public"."claim_next_due_user"(
  p_run_at_utc timestamp with time zone DEFAULT now(),
  p_lease_ttl_minutes integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lease_cutoff timestamp with time zone := p_run_at_utc - make_interval(mins => p_lease_ttl_minutes);
  v_candidate uuid;
  v_claimed uuid;
BEGIN
  SELECT u.id
  INTO v_candidate
  FROM public.users u
  WHERE
    NOT EXISTS (
      SELECT 1
      FROM public.cron_selection_leases l
      WHERE l.user_id = u.id
        AND l.leased_at > v_lease_cutoff
    )
    AND (
      (extract(hour FROM timezone(u.timezone, p_run_at_utc))::int * 60)
      + extract(minute FROM timezone(u.timezone, p_run_at_utc))::int
    ) >= greatest(u.send_time_local_minute - 3, 0)
    AND (
      u.last_issue_sent_at IS NULL
      OR (timezone(u.timezone, u.last_issue_sent_at))::date < (timezone(u.timezone, p_run_at_utc))::date
    )
  ORDER BY u.last_issue_sent_at ASC NULLS FIRST, u.id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_candidate IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.cron_selection_leases (user_id, leased_at)
  VALUES (v_candidate, p_run_at_utc)
  ON CONFLICT (user_id) DO UPDATE
    SET leased_at = EXCLUDED.leased_at
  WHERE public.cron_selection_leases.leased_at <= v_lease_cutoff
  RETURNING user_id
  INTO v_claimed;

  RETURN v_claimed;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."claim_due_users_batch"(
  p_run_at_utc timestamp with time zone DEFAULT now(),
  p_lease_ttl_minutes integer DEFAULT 5,
  p_batch_size integer DEFAULT 1
)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lease_cutoff timestamp with time zone := p_run_at_utc - make_interval(mins => p_lease_ttl_minutes);
  v_effective_batch_size integer := greatest(1, least(coalesce(p_batch_size, 1), 100));
BEGIN
  RETURN QUERY
  WITH locked_candidates AS (
    SELECT
      u.id,
      u.last_issue_sent_at
    FROM public.users u
    WHERE
      NOT EXISTS (
        SELECT 1
        FROM public.cron_selection_leases l
        WHERE l.user_id = u.id
          AND l.leased_at > v_lease_cutoff
      )
      AND (
        (extract(hour FROM timezone(u.timezone, p_run_at_utc))::int * 60)
        + extract(minute FROM timezone(u.timezone, p_run_at_utc))::int
      ) >= greatest(u.send_time_local_minute - 3, 0)
      AND (
        u.last_issue_sent_at IS NULL
        OR (timezone(u.timezone, u.last_issue_sent_at))::date < (timezone(u.timezone, p_run_at_utc))::date
      )
    FOR UPDATE SKIP LOCKED
  ),
  due_candidates AS (
    SELECT
      lc.id,
      row_number() OVER (ORDER BY lc.last_issue_sent_at ASC NULLS FIRST, lc.id ASC) AS candidate_rank
    FROM locked_candidates lc
  ),
  limited_candidates AS (
    SELECT dc.id, dc.candidate_rank
    FROM due_candidates dc
    ORDER BY dc.candidate_rank ASC
    LIMIT v_effective_batch_size
  ),
  leased AS (
    INSERT INTO public.cron_selection_leases (user_id, leased_at)
    SELECT c.id, p_run_at_utc
    FROM limited_candidates c
    ON CONFLICT ON CONSTRAINT cron_selection_leases_pkey DO UPDATE
      SET leased_at = EXCLUDED.leased_at
    WHERE public.cron_selection_leases.leased_at <= v_lease_cutoff
    RETURNING public.cron_selection_leases.user_id AS leased_user_id
  )
  SELECT c.id AS user_id
  FROM limited_candidates c
  INNER JOIN leased l ON l.leased_user_id = c.id
  ORDER BY c.candidate_rank ASC;
END;
$$;
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_select_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_select_self_by_email"
ON "users"
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_update_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_update_self_by_email"
ON "users"
FOR UPDATE
TO authenticated
USING (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')))
WITH CHECK (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));
