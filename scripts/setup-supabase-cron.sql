-- Supabase scheduler setup (DB-native claim function)
-- Run in Supabase SQL Editor (staging first).

create extension if not exists pg_cron with schema extensions;

-- Remove old schedule if it exists.
select cron.unschedule('newsletter-generate-next-every-minute')
where exists (
  select 1
  from cron.job
  where jobname = 'newsletter-generate-next-every-minute'
);

-- Schedule: every minute, run selector logic inside Postgres.
select cron.schedule(
  'newsletter-generate-next-every-minute',
  '* * * * *',
  $$
  select public.claim_next_due_user(now(), 5);
  $$
);

-- Optional check: inspect active job.
-- select jobid, jobname, schedule, active, command from cron.job where jobname = 'newsletter-generate-next-every-minute';
