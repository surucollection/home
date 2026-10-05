-- Prevent shipment creation for COD orders whose required advance is unpaid.
create or replace function public.enforce_cod_advance_order_status()
returns trigger
language plpgsql
security invoker
set search_path=public
as $function$
begin
  if new.payment_method = 'cod'
     and coalesce(new.cod_advance_required, 0) > 0
     and coalesce(new.cod_advance_paid, 0) < coalesce(new.cod_advance_required, 0)
     and coalesce(new.cod_advance_payment_status, 'pending') <> 'paid' then
    if new.order_status in ('confirmed','processing','packed','shipped','delivered') then
      raise exception 'COD order requires the advance to be paid before fulfillment status can be set';
    end if;
    if new.ncm_order_id is not null
       and (tg_op = 'INSERT' or old.ncm_order_id is null) then
      raise exception 'COD order requires the advance to be paid before a shipment can be created';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_cod_advance_order_status on public.orders;
create trigger enforce_cod_advance_order_status
before insert or update of order_status,payment_method,cod_advance_required,cod_advance_paid,cod_advance_payment_status,ncm_order_id
on public.orders
for each row
execute function public.enforce_cod_advance_order_status();

revoke all on function public.enforce_cod_advance_order_status() from public, anon, authenticated;
