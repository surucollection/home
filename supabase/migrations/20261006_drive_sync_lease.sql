create table if not exists public.drive_sync_leases (
  name text primary key,
  locked_until timestamptz not null default to_timestamp(0),
  updated_at timestamptz not null default now()
);

alter table public.drive_sync_leases enable row level security;

revoke all on table public.drive_sync_leases from anon, authenticated;
grant all on table public.drive_sync_leases to service_role;

drop policy if exists "service role manages drive sync lease" on public.drive_sync_leases;
create policy "service role manages drive sync lease"
  on public.drive_sync_leases
  for all
  to service_role
  using (true)
  with check (true);

insert into public.drive_sync_leases(name, locked_until)
values ('google-drive-image-sync', to_timestamp(0))
on conflict (name) do nothing;