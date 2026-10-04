alter table public.order_items
  drop constraint if exists order_items_advance_payment_gateway_check;

alter table public.order_items
  add constraint order_items_advance_payment_gateway_check
  check (
    advance_payment_gateway is null
    or advance_payment_gateway in ('dynamic_qr','fonepay','esewa','khalti','other')
  );

comment on column public.order_items.advance_payment_gateway is
  'Gateway/provider identifier for preorder advance. dynamic_qr is the currently available manual QR method; provider-specific values are reserved for future verified integrations.';
