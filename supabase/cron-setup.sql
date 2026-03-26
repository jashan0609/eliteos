-- ═══════════════════════════════════════════════════════════
-- EliteOS Daily Reset Cron Setup
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Step 1: Enable pg_cron and pg_net extensions
-- (pg_cron may already be enabled on Supabase Pro plans)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Step 2: Schedule the daily-reset Edge Function to run at 00:00 UTC every day
-- Replace <YOUR_PROJECT_REF> with your Supabase project ref (e.g., mfrffkbbkiiznbgwqxdw)
-- Replace <YOUR_SERVICE_ROLE_KEY> with your service role key (found in Project Settings > API)

select cron.schedule(
  'eliteos-daily-reset',          -- job name
  '0 0 * * *',                    -- cron expression: midnight UTC daily
  $$
  select net.http_post(
    url := 'https://mfrffkbbkiiznbgwqxdw.supabase.co/functions/v1/daily-reset',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ═══ Useful commands ═══

-- View scheduled jobs:
-- select * from cron.job;

-- View job run history:
-- select * from cron.job_run_details order by start_time desc limit 10;

-- Unschedule the job:
-- select cron.unschedule('eliteos-daily-reset');
