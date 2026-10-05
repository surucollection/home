alter table public.orders
  add column if not exists cod_advance_required numeric(12,2) not null default 0,
  add column if not exists cod_advance_paid numeric(12,2) not null default 0,
  add column if not exists cod_balance_due numeric(12,2) not null default 0,
  add column if not exists cod_advance_payment_status text not null default 'not_required',
  add column if not exists cod_advance_fonepay_reference text,
  add column if not exists cod_advance_fonepay_trace_id text,
  add column if not exists cod_advance_fonepay_response jsonb,
  add column if not exists cod_advance_fonepay_initiated_at timestamptz,
  add column if not exists cod_advance_fonepay_paid_at timestamptz;

alter table public.orders drop constraint if exists orders_cod_advance_payment_status_check;
alter table public.orders add constraint orders_cod_advance_payment_status_check
  check (cod_advance_payment_status in ('not_required','pending','initiated','paid','failed','expired','refunded'));
alter table public.orders drop constraint if exists orders_cod_advance_required_check;
alter table public.orders add constraint orders_cod_advance_required_check check (cod_advance_required >= 0);
alter table public.orders drop constraint if exists orders_cod_advance_paid_check;
alter table public.orders add constraint orders_cod_advance_paid_check check (cod_advance_paid >= 0);
alter table public.orders drop constraint if exists orders_cod_balance_due_check;
alter table public.orders add constraint orders_cod_balance_due_check check (cod_balance_due >= 0);
create unique index if not exists orders_cod_advance_fonepay_reference_uidx
  on public.orders(cod_advance_fonepay_reference)
  where cod_advance_fonepay_reference is not null;


-- The place_order RPC now calculates the COD advance server-side:
-- COD orders require min(NPR 300, order total) before confirmation.
-- The full order total remains unchanged; cod_balance_due tracks the amount due at delivery.
