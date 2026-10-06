create table if not exists public.ncm_delivery_rate_cache (
  origin_branch text not null,
  destination_branch text not null,
  delivery_type text not null default 'Pickup/Collect',
  ncm_charge numeric(12,2) not null check (ncm_charge >= 0),
  door_pickup_charge numeric(12,2) not null default 15 check (door_pickup_charge >= 0),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  raw_response jsonb not null default '{}'::jsonb,
  primary key (origin_branch,destination_branch,delivery_type)
);

alter table public.ncm_delivery_rate_cache enable row level security;
revoke all on public.ncm_delivery_rate_cache from anon, authenticated;
drop policy if exists "No direct client access" on public.ncm_delivery_rate_cache;
create policy "No direct client access"
  on public.ncm_delivery_rate_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);
grant all on table public.ncm_delivery_rate_cache to service_role;

do $$
declare
  v_def text;
  v_old text := 'v_cod_advance:=case when p_payment_method=''cod'' then least(300,v_final_total) else 0 end;';
  v_new text := $replace$
v_cod_advance:=0;
 if p_payment_method='cod' then
   if v_ncm_destination_branch is null then raise exception 'Please select an NCM delivery branch for COD orders'; end if;
   select least(v_final_total,round(coalesce(r.ncm_charge,0)+coalesce(r.door_pickup_charge,15)))
   into v_cod_advance
   from public.ncm_delivery_rate_cache r
   where upper(trim(r.origin_branch))='GAUR'
     and upper(trim(r.destination_branch))=upper(trim(v_ncm_destination_branch))
     and r.delivery_type='Pickup/Collect'
     and r.expires_at>now()
   order by r.fetched_at desc
   limit 1;
   if not found then
     raise exception 'NCM door-to-door delivery rate is unavailable for the selected branch. Please refresh the delivery charge and try again';
   end if;
 end if;
$replace$;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='place_order'
    and p.pronargs=6
  limit 1;
  if v_def is null then
    raise exception 'Current 6-argument public.place_order function was not found';
  end if;
  if position(v_old in v_def)=0 then
    raise exception 'Expected fixed COD advance expression was not found in public.place_order';
  end if;
  execute replace(v_def,v_old,v_new);
end
$$;