begin;

create table if not exists public.customer_wishlist (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint customer_wishlist_pkey primary key (customer_id, product_id)
);

create index if not exists customer_wishlist_product_id_idx
  on public.customer_wishlist(product_id);

alter table public.customer_wishlist enable row level security;

drop policy if exists "Customers can read their wishlist" on public.customer_wishlist;
create policy "Customers can read their wishlist"
on public.customer_wishlist
for select to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_wishlist.customer_id
      and c.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Customers can add to their wishlist" on public.customer_wishlist;
create policy "Customers can add to their wishlist"
on public.customer_wishlist
for insert to authenticated
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_wishlist.customer_id
      and c.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Customers can remove from their wishlist" on public.customer_wishlist;
create policy "Customers can remove from their wishlist"
on public.customer_wishlist
for delete to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_wishlist.customer_id
      and c.auth_user_id = (select auth.uid())
  )
);

grant usage on schema public to authenticated;
grant select, insert, delete on table public.customer_wishlist to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'customer_wishlist'
     ) then
    alter publication supabase_realtime add table public.customer_wishlist;
  end if;
end
$$;

comment on table public.customer_wishlist is
  'Customer-owned saved products shared between the Suru Collection website and native apps.';

commit;
