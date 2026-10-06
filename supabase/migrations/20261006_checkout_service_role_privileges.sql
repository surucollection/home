-- Ensure backend Edge Functions can access server-only checkout caches.
grant select, insert, update on public.ncm_delivery_rate_cache to service_role;
grant select, insert, update, delete on public.preorder_payment_intents to service_role;
