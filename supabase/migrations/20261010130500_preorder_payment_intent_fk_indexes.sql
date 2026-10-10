-- Add indexes for preorder payment intent foreign keys flagged by Supabase performance advisors.
-- Additive only; does not change payment behavior or existing data.
create index if not exists preorder_payment_intents_order_id_idx
  on public.preorder_payment_intents (order_id);

create index if not exists preorder_payment_intents_product_id_idx
  on public.preorder_payment_intents (product_id);
