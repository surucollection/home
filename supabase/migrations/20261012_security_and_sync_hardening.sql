DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'suru_ncm_sync_cron'
  ) THEN
    PERFORM vault.create_secret(
      gen_random_uuid()::text,
      'suru_ncm_sync_cron',
      'Internal NCM status-sync cron authentication secret'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_ncm_sync_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'suru_ncm_sync_cron'
      AND decrypted_secret = p_secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_ncm_sync_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ncm_sync_cron_secret(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_discount_coupon(text, numeric) FROM anon;

SELECT cron.alter_job(
  job_id := 2,
  schedule := '0 * * * *',
  command := $cron$
    select net.http_post(
      url := 'https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/ncm-sync-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'suru_ncm_sync_cron')
      ),
      body := jsonb_build_object('time', now()),
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
