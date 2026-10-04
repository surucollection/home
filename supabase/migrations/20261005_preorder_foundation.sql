-- Preorder foundation for Suru Collection.
-- Additive only: existing checkout/order behavior remains unchanged until the
-- dedicated preorder RPC and storefront/admin integration are deployed.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_advance_percent numeric(5,2) NOT NULL DEFAULT 30
    CHECK (preorder_advance_percent > 0 AND preorder_advance_percent <= 100);

ALTER TABLE public.product_sizes
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean,
  ADD COLUMN IF NOT EXISTS preorder_advance_percent numeric(5,2)
    CHECK (preorder_advance_percent IS NULL OR
           (preorder_advance_percent > 0 AND preorder_advance_percent <= 100));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS balance_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS preorder_status text
    CHECK (preorder_status IS NULL OR preorder_status IN
      ('awaiting_advance','confirmed','stock_allocated','balance_due','fulfilled','cancelled'));

CREATE TABLE IF NOT EXISTS public.preorder_stock_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  size_id uuid REFERENCES public.product_sizes(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  allocated_by uuid,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS preorder_order_items_queue_idx
  ON public.order_items (preorder_status, created_at)
  WHERE is_preorder = true;

CREATE INDEX IF NOT EXISTS preorder_allocations_item_idx
  ON public.preorder_stock_allocations (order_item_id);

ALTER TABLE public.preorder_stock_allocations ENABLE ROW LEVEL SECURITY;

-- No direct client access: allocation will be performed only by a
-- permission-checked admin RPC in the next implementation step.
REVOKE ALL ON public.preorder_stock_allocations FROM anon, authenticated;
