alter table public.orders
  add column if not exists fonepay_reference text,
  add column if not exists fonepay_trace_id text,
  add column if not exists fonepay_status text,
  add column if not exists fonepay_response jsonb,
  add column if not exists fonepay_initiated_at timestamptz,
  add column if not exists fonepay_paid_at timestamptz;

create unique index if not exists orders_fonepay_reference_uidx
  on public.orders(fonepay_reference)
  where fonepay_reference is not null;
