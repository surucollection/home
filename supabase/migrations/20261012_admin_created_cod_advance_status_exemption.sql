-- Apply COD advance fulfillment restrictions only to website-created orders.
-- Admin-created orders can be confirmed/processed manually even while unpaid.
create or replace function public.enforce_cod_advance_order_status()
returns trigger
language plpgsql
security invoker
set search_path=public
as $function$
begin
  if coalesce(lower(trim(new.order_source)), 'website') = 'website'
     and new.payment_method = 'cod'
     and coalesce(new.cod_advance_required, 0) > 0
     and coalesce(new.cod_advance_paid, 0) < coalesce(new.cod_advance_required, 0)
     and coalesce(new.cod_advance_payment_status, 'pending') <> 'paid'
     and new.order_status in ('confirmed','processing','packed','shipped','delivered') then
    raise exception 'COD order requires the advance to be paid before fulfillment status can be set';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_cod_advance_order_status() from public, anon, authenticated;
