begin;

drop policy if exists "Admins can manage customers" on public.customers;
drop policy if exists "Customers can insert own profile" on public.customers;
drop policy if exists "Customers can read own profile" on public.customers;
drop policy if exists "Customers can update own profile" on public.customers;

create policy "Customers and admins can insert customers"
on public.customers for insert to authenticated
with check (auth_user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers and admins can read customers"
on public.customers for select to authenticated
using (auth_user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers and admins can update customers"
on public.customers for update to authenticated
using (auth_user_id = (select auth.uid()) or (select public.is_admin()))
with check (auth_user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins can delete customers"
on public.customers for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can manage order items" on public.order_items;
drop policy if exists "Customers can read own order items" on public.order_items;

create policy "Customers and admins can read order items"
on public.order_items for select to authenticated
using (
  order_id in (
    select o.id
    from public.orders o
    join public.customers c on c.id = o.customer_id
    where c.auth_user_id = (select auth.uid())
  )
  or (select public.is_admin())
);

create policy "Admins can insert order items"
on public.order_items for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update order items"
on public.order_items for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete order items"
on public.order_items for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can manage orders" on public.orders;
drop policy if exists "Customers can read own orders" on public.orders;

create policy "Customers and admins can read orders"
on public.orders for select to authenticated
using (
  customer_id in (
    select c.id from public.customers c
    where c.auth_user_id = (select auth.uid())
  )
  or (select public.is_admin())
);

create policy "Admins can insert orders"
on public.orders for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update orders"
on public.orders for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete orders"
on public.orders for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Public can view active products" on public.products;

create policy "Public can view active products"
on public.products for select to anon
using (is_active = true);

create policy "Authenticated users and admins can view products"
on public.products for select to authenticated
using (is_active = true or (select public.is_admin()));

create policy "Admins can insert products"
on public.products for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update products"
on public.products for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete products"
on public.products for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can manage product sizes" on public.product_sizes;
drop policy if exists "Public can view active sizes" on public.product_sizes;

create policy "Public can view active sizes"
on public.product_sizes for select to anon
using (
  is_active = true
  and exists (
    select 1 from public.products p
    where p.id = product_sizes.product_id and p.is_active = true
  )
);

create policy "Authenticated users and admins can view sizes"
on public.product_sizes for select to authenticated
using (
  (
    is_active = true
    and exists (
      select 1 from public.products p
      where p.id = product_sizes.product_id and p.is_active = true
    )
  )
  or (select public.is_admin())
);

create policy "Admins can insert product sizes"
on public.product_sizes for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update product sizes"
on public.product_sizes for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete product sizes"
on public.product_sizes for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can manage product images" on public.product_images;
drop policy if exists "Public can view product images" on public.product_images;

create policy "Public can view product images"
on public.product_images for select to anon
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active = true
  )
);

create policy "Authenticated users and admins can view product images"
on public.product_images for select to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active = true
  )
  or (select public.is_admin())
);

create policy "Admins can insert product images"
on public.product_images for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update product images"
on public.product_images for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete product images"
on public.product_images for delete to authenticated
using ((select public.is_admin()));

commit;
