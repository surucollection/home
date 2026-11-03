begin;

drop policy if exists "Read approved or own product reviews" on public.product_reviews;
drop policy if exists "Public can read approved product reviews" on public.product_reviews;
drop policy if exists "Authenticated users can read approved or own product reviews" on public.product_reviews;

create policy "Public can read approved product reviews"
on public.product_reviews
for select
to anon
using (is_approved = true);

create policy "Authenticated users can read approved or own product reviews"
on public.product_reviews
for select
to authenticated
using (
  is_approved = true
  or user_id = (select auth.uid())
  or (select public.is_admin())
);

commit;
