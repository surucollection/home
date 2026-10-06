do $$
declare
  ext_schema text;
begin
  select n.nspname
    into ext_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if ext_schema = 'public' then
    if exists (select 1 from cron.job where jobname = 'ncm-status-sync-hourly') then
      perform cron.unschedule('ncm-status-sync-hourly');
    end if;

    if exists (select 1 from cron.job where jobname = 'suru-drive-image-sync') then
      perform cron.unschedule('suru-drive-image-sync');
    end if;

    drop extension pg_net;
    create extension pg_net with schema extensions;

    if not exists (select 1 from cron.job where jobname = 'ncm-status-sync-hourly') then
      perform cron.schedule(
        'ncm-status-sync-hourly',
        '0 * * * *',
        $job$
          select net.http_post(
            url := 'https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/ncm-sync-cron',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'suru_ncm_sync_cron')
            ),
            body := jsonb_build_object('time', now()),
            timeout_milliseconds := 10000
          ) as request_id;
        $job$
      );
    end if;

    if not exists (select 1 from cron.job where jobname = 'suru-drive-image-sync') then
      perform cron.schedule(
        'suru-drive-image-sync',
        '*/5 * * * *',
        $job$
          select net.http_post(
            url := 'https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image-sync',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'suru_drive_sync_cron')
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 60000
          ) as request_id;
        $job$
      );
    end if;
  end if;
end $$;
