ALTER TABLE "users"
ADD COLUMN "send_time_local_minute" integer GENERATED ALWAYS AS (
  (split_part(send_time_local, ':', 1)::int * 60) + split_part(send_time_local, ':', 2)::int
) STORED;
--> statement-breakpoint
CREATE INDEX "users_send_time_local_minute_idx" ON "users" USING btree ("send_time_local_minute");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."claim_due_users_batch"(
  p_run_at_utc timestamp with time zone DEFAULT now(),
  p_lease_ttl_minutes integer DEFAULT 5,
  p_batch_size integer DEFAULT 1
)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease_cutoff timestamp with time zone := p_run_at_utc - make_interval(mins => p_lease_ttl_minutes);
  v_effective_batch_size integer := greatest(1, least(coalesce(p_batch_size, 1), 100));
BEGIN
  RETURN QUERY
  WITH due_candidates AS (
    SELECT id, candidate_rank
    FROM (
      SELECT
        u.id,
        row_number() OVER (ORDER BY u.last_issue_sent_at ASC NULLS FIRST, u.id ASC) AS candidate_rank
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
        ) >= u.send_time_local_minute
        AND (
          u.last_issue_sent_at IS NULL
          OR (timezone(u.timezone, u.last_issue_sent_at))::date < (timezone(u.timezone, p_run_at_utc))::date
        )
      FOR UPDATE SKIP LOCKED
    ) ranked
    ORDER BY candidate_rank ASC
    LIMIT v_effective_batch_size
  ),
  leased AS (
    INSERT INTO public.cron_selection_leases (user_id, leased_at)
    SELECT d.id, p_run_at_utc
    FROM due_candidates d
    ON CONFLICT (user_id) DO UPDATE
      SET leased_at = EXCLUDED.leased_at
    WHERE public.cron_selection_leases.leased_at <= v_lease_cutoff
    RETURNING user_id
  )
  SELECT d.id AS user_id
  FROM due_candidates d
  INNER JOIN leased l ON l.user_id = d.id
  ORDER BY d.candidate_rank ASC;
END;
$$;
