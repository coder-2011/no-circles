-- Supabase scheduler setup (HTTP trigger + DB cleanup jobs)
-- Run in Supabase SQL Editor (staging first).
--
-- Required manual edits before running:
-- 1) Replace APP_BASE_URL with your deployed app base URL (no trailing slash).
-- 2) Replace CRON_SECRET_VALUE with the same value used by app/api/cron/generate-next.
-- 3) Keep job names stable for idempotent re-runs.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove old newsletter schedule if it exists.
select cron.unschedule('newsletter-generate-next-every-minute')
where exists (
  select 1
  from cron.job
  where jobname = 'newsletter-generate-next-every-minute'
);

-- Remove old idempotency prune schedule if it exists.
select cron.unschedule('prune-processed-webhooks-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'prune-processed-webhooks-daily'
);

-- Schedule: every minute, call the app cron route (which runs claim + send pipeline).
select cron.schedule(
  'newsletter-generate-next-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://APP_BASE_URL/api/cron/generate-next',
    headers := jsonb_build_object(
      'authorization', 'Bearer CRON_SECRET_VALUE',
      'content-type', 'application/json'
    ),
    body := '{"batch_size":10}'::jsonb
  );
  $$
);

-- Schedule: daily replay-table retention cleanup for inbound idempotency.
select cron.schedule(
  'prune-processed-webhooks-daily',
  '17 3 * * *',
  $$
  with deleted as (
    delete from public.processed_webhooks
    where processed_at < now() - interval '30 days'
    returning 1
  )
  select count(*) from deleted;
  $$
);

-- Optional check: inspect active jobs.
-- select jobid, jobname, schedule, active, command from cron.job where jobname in ('newsletter-generate-next-every-minute', 'prune-processed-webhooks-daily');
