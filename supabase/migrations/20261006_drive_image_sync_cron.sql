create or replace function public.verify_drive_sync_cron_secret(p_secret text)
returns boolean language plpgsql security definer set search_path=public,vault as $$
begin
  return exists(select 1 from vault.decrypted_secrets where name='suru_drive_sync_cron' and decrypted_secret=p_secret);
end $$;
revoke all on function public.verify_drive_sync_cron_secret(text) from public,anon,authenticated;
grant execute on function public.verify_drive_sync_cron_secret(text) to service_role;
do $$ begin
  if not exists(select 1 from vault.secrets where name='suru_drive_sync_cron') then
    perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'suru_drive_sync_cron','Internal credential for Suru Collection Google Drive image sync cron');
  end if;
end $$;
do $$ declare v_job bigint; begin
  select jobid into v_job from cron.job where jobname='suru-drive-image-sync';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('suru-drive-image-sync','*/5 * * * *',
    $job$select net.http_post(
      url:='https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image-sync',
      headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='suru_drive_sync_cron')),
      body:='{}'::jsonb,timeout_milliseconds:=20000) as request_id;$job$);
end $$;