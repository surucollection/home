-- The admin preorder review and Fonepay finalization flows use
-- 'verified' as the post-review/post-gateway status for advance_payment_status.
alter table public.order_items
  drop constraint if exists order_items_advance_payment_status_check;

alter table public.order_items
  add constraint order_items_advance_payment_status_check
  check (
    advance_payment_status = any (array[
      'pending'::text,
      'submitted'::text,
      'initiated'::text,
      'paid'::text,
      'verified'::text,
      'failed'::text,
      'expired'::text,
      'refunded'::text
    ])
  );