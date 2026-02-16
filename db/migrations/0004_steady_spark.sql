CREATE TABLE "cron_selection_leases" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"leased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cron_selection_leases" ADD CONSTRAINT "cron_selection_leases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cron_selection_leases_leased_at_idx" ON "cron_selection_leases" USING btree ("leased_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."claim_next_due_user"(
  p_run_at_utc timestamp with time zone DEFAULT now(),
  p_lease_ttl_minutes integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
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
    AND (timezone(u.timezone, p_run_at_utc))::time >= make_time(
      split_part(u.send_time_local, ':', 1)::int,
      split_part(u.send_time_local, ':', 2)::int,
      0
    )
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
