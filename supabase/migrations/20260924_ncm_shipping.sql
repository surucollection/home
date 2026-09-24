ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ncm_order_id bigint,
  ADD COLUMN IF NOT EXISTS ncm_status text,
  ADD COLUMN IF NOT EXISTS ncm_delivery_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ncm_delivery_type text,
  ADD COLUMN IF NOT EXISTS ncm_source_branch text,
  ADD COLUMN IF NOT EXISTS ncm_destination_branch text,
  ADD COLUMN IF NOT EXISTS ncm_tracking_id text,
  ADD COLUMN IF NOT EXISTS ncm_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS ncm_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS ncm_response jsonb;

CREATE INDEX IF NOT EXISTS orders_ncm_order_id_idx
  ON public.orders (ncm_order_id)
  WHERE ncm_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_ncm_status_idx
  ON public.orders (ncm_status)
  WHERE ncm_status IS NOT NULL;
