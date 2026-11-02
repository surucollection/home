alter table public.orders
  add column if not exists ncm_return_ticket_id text,
  add column if not exists ncm_reverse_pickup_status text,
  add column if not exists ncm_reverse_pickup_requested_at timestamptz,
  add column if not exists ncm_reverse_pickup_reason text,
  add column if not exists ncm_reverse_pickup_response jsonb;

comment on column public.orders.ncm_return_ticket_id is
  'NCM vendor support ticket ID requesting customer reverse pickup after delivery.';
comment on column public.orders.ncm_reverse_pickup_status is
  'Local tracking state for an NCM customer reverse-pickup support ticket; ticket_submitted does not mean pickup is confirmed.';
