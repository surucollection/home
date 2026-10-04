alter table public.order_items
  add column if not exists advance_payment_status text not null default 'pending',
  add column if not exists advance_payment_gateway text,
  add column if not exists advance_payment_transaction_id text,
  add column if not exists advance_payment_session_id text,
  add column if not exists advance_payment_initiated_at timestamptz,
  add column if not exists advance_payment_expires_at timestamptz;

alter table public.order_items
  drop constraint if exists order_items_advance_payment_status_check;
alter table public.order_items
  add constraint order_items_advance_payment_status_check
  check (advance_payment_status in ('pending','initiated','paid','failed','expired','refunded'));

alter table public.order_items
  drop constraint if exists order_items_advance_payment_gateway_check;
alter table public.order_items
  add constraint order_items_advance_payment_gateway_check
  check (advance_payment_gateway is null or advance_payment_gateway = 'fonepay');

create unique index if not exists order_items_advance_payment_transaction_uidx
  on public.order_items (advance_payment_gateway, advance_payment_transaction_id)
  where advance_payment_transaction_id is not null;

create index if not exists order_items_preorder_advance_status_idx
  on public.order_items (advance_payment_status, advance_payment_initiated_at)
  where is_preorder = true;
