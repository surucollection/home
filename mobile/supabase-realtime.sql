-- Enable Supabase Realtime for the tables used by the mobile catalogue.
-- The existing orders table is already in this publication.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'products',
    'product_images',
    'product_sizes',
    'discount_coupons'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
