create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  district text not null,
  province text not null,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_customer_id_idx
  on public.customer_addresses(customer_id);

create unique index customer_addresses_one_default_idx
  on public.customer_addresses(customer_id)
  where is_default;

alter table public.customer_addresses enable row level security;

create policy "Customers can read their saved addresses"
on public.customer_addresses
for select to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and (c.auth_user_id = auth.uid() or public.is_admin())
  )
);

create policy "Customers can insert their saved addresses"
on public.customer_addresses
for insert to authenticated
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and (c.auth_user_id = auth.uid() or public.is_admin())
  )
);

create policy "Customers can update their saved addresses"
on public.customer_addresses
for update to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and (c.auth_user_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and (c.auth_user_id = auth.uid() or public.is_admin())
  )
);

create policy "Customers can delete their saved addresses"
on public.customer_addresses
for delete to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and (c.auth_user_id = auth.uid() or public.is_admin())
  )
);

create or replace function public.save_customer_address(
  p_address_id uuid,
  p_label text,
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_district text,
  p_province text,
  p_postal_code text default null,
  p_is_default boolean default false
)
returns public.customer_addresses
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_row public.customer_addresses;
  v_make_default boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select c.id into v_customer_id
    from public.customers c
   where c.auth_user_id = v_uid
   limit 1;

  if v_customer_id is null then
    raise exception 'Customer profile not found';
  end if;

  if coalesce(trim(p_label), '') = ''
     or coalesce(trim(p_full_name), '') = ''
     or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_city), '') = ''
     or coalesce(trim(p_district), '') = ''
     or coalesce(trim(p_province), '') = '' then
    raise exception 'Address details are incomplete';
  end if;

  if p_address_id is not null and not exists (
    select 1 from public.customer_addresses a
     where a.id = p_address_id
       and a.customer_id = v_customer_id
  ) then
    raise exception 'Address not found';
  end if;

  v_make_default := coalesce(p_is_default, false)
    or not exists (
      select 1 from public.customer_addresses a
       where a.customer_id = v_customer_id
         and (p_address_id is null or a.id <> p_address_id)
    );

  if v_make_default then
    update public.customer_addresses
       set is_default = false
     where customer_id = v_customer_id
       and (p_address_id is null or id <> p_address_id);
  end if;

  if p_address_id is null then
    insert into public.customer_addresses(
      customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default,updated_at
    )
    values(
      v_customer_id,trim(p_label),trim(p_full_name),trim(p_phone),trim(p_address),trim(p_city),
      trim(p_district),trim(p_province),nullif(trim(p_postal_code),''),v_make_default,now()
    )
    returning * into v_row;
  else
    update public.customer_addresses
       set label=trim(p_label),
           full_name=trim(p_full_name),
           phone=trim(p_phone),
           address=trim(p_address),
           city=trim(p_city),
           district=trim(p_district),
           province=trim(p_province),
           postal_code=nullif(trim(p_postal_code),''),
           is_default=v_make_default,
           updated_at=now()
     where id=p_address_id
       and customer_id=v_customer_id
    returning * into v_row;
  end if;

  if v_make_default then
    update public.customers
       set address=v_row.address,
           city=v_row.city,
           district=v_row.district,
           province=v_row.province,
           postal_code=v_row.postal_code,
           ncm_destination_branch=null,
           updated_at=now()
     where id=v_customer_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.save_customer_address(uuid,text,text,text,text,text,text,text,text,boolean)
to authenticated;

create or replace function public.delete_customer_address(p_address_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_was_default boolean;
  v_next public.customer_addresses;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select c.id into v_customer_id
    from public.customers c
   where c.auth_user_id = v_uid
   limit 1;

  if v_customer_id is null then
    raise exception 'Customer profile not found';
  end if;

  select is_default into v_was_default
    from public.customer_addresses
   where id=p_address_id and customer_id=v_customer_id
   for update;

  if not found then
    raise exception 'Address not found';
  end if;

  delete from public.customer_addresses
   where id=p_address_id and customer_id=v_customer_id;

  if v_was_default then
    select * into v_next
      from public.customer_addresses
     where customer_id=v_customer_id
     order by created_at desc, id desc
     limit 1;

    if v_next.id is not null then
      update public.customer_addresses set is_default=true,updated_at=now() where id=v_next.id;
      update public.customers
         set address=v_next.address,
             city=v_next.city,
             district=v_next.district,
             province=v_next.province,
             postal_code=v_next.postal_code,
             ncm_destination_branch=null,
             updated_at=now()
       where id=v_customer_id;
    else
      update public.customers
         set address=null,city=null,district=null,province=null,postal_code=null,
             ncm_destination_branch=null,updated_at=now()
       where id=v_customer_id;
    end if;
  end if;

  return p_address_id;
end;
$$;

grant execute on function public.delete_customer_address(uuid)
to authenticated;

insert into public.customer_addresses(
  customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default
)
select
  c.id,
  'Home',
  coalesce(nullif(trim(c.name),''),'Customer'),
  c.phone,
  c.address,
  c.city,
  c.district,
  c.province,
  c.postal_code,
  true
from public.customers c
where coalesce(trim(c.address),'') <> ''
  and coalesce(trim(c.city),'') <> ''
  and coalesce(trim(c.district),'') <> ''
  and coalesce(trim(c.province),'') <> ''
  and not exists (
    select 1 from public.customer_addresses a where a.customer_id=c.id
  );
