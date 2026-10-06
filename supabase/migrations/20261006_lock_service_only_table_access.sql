begin;

drop policy if exists "No direct client access" on public.coupon_redemptions;
create policy "No direct client access"
on public.coupon_redemptions
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct client access" on public.guest_carts;
create policy "No direct client access"
on public.guest_carts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct client access" on public.preorder_stock_allocations;
create policy "No direct client access"
on public.preorder_stock_allocations
for all
to anon, authenticated
using (false)
with check (false);

commit;
