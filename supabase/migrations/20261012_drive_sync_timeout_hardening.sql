SELECT cron.alter_job(
  job_id := 4,
  schedule := '*/5 * * * *',
  command := $cron$
    select net.http_post(
      url := 'https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'suru_drive_sync_cron')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
