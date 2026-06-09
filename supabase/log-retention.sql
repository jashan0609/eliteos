-- Keep only the recent month of logs.
-- Run this in Supabase SQL Editor.

-- Helpful index for retention cleanup and month-window queries.
create index if not exists daily_logs_user_date_idx
  on daily_logs (user_id, date desc);

-- One-time cleanup: remove logs older than rolling 1 month.
delete from daily_logs
where date < (current_date - interval '1 month');

-- Optional: schedule daily cleanup (01:15 UTC) with pg_cron.
create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'eliteos-log-retention'
  ) then
    perform cron.schedule(
      'eliteos-log-retention',
      '15 1 * * *',
      $job$
      delete from daily_logs
      where date < (current_date - interval '1 month');
      $job$
    );
  end if;
end
$$;
