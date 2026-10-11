-- Background rest alarm: one live timer per user, and a 5 second cron that only calls the push function when work exists.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- At most one pending timer per user (the cap the brief asks for). The client cancels the old one before arming a new one.
create unique index rest_timers_one_pending on public.rest_timers (user_id)
  where sent_at is null and cancelled_at is null and deleted_at is null;
create index rest_timers_due on public.rest_timers (fire_at)
  where sent_at is null and cancelled_at is null and deleted_at is null;

-- Secrets `project_url` and `service_role_key` live in Vault (see docs/setup-supabase.md). Without them the job
-- fails only when a timer is due, and the on-screen timer is unaffected.
select cron.schedule(
  'send-rest-push',
  '5 seconds',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-rest-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  where exists (
    select 1 from public.rest_timers
    where sent_at is null and cancelled_at is null and deleted_at is null and fire_at <= now() + interval '6 seconds'
  );
  $job$
);
