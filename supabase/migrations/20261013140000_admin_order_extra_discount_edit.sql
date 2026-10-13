alter table public.orders
  add column if not exists manual_discount_amount numeric(12,2) not null default 0;

create or replace function public.admin_update_order_extra_discount(
  p_order_id uuid,
  p_manual_discount_amount numeric,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_old_manual numeric(12,2);
  v_new_manual numeric(12,2);
  v_discount_base numeric(12,2);
  v_new_discount numeric(12,2);
  v_new_total numeric(12,2);
  v_invoice jsonb;
  v_invoice_updated boolean := false;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null
     or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Enter a change reason (3–500 characters)';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if lower(coalesce(v_order.order_status,'')) not in ('pending','confirmed','processing','packed')
     and not (lower(coalesce(v_order.order_status,''))='shipped'
       and v_order.ncm_order_id is not null
       and lower(coalesce(v_order.ncm_status,'')) ~ '(cancelled|canceled)') then
    raise exception 'Discount changes are only allowed before shipment or delivery';
  end if;
  if v_order.inventory_released_at is not null then
    raise exception 'Inventory for this order has already been released. The order cannot be edited.';
  end if;

  v_old_manual := greatest(0,coalesce(v_order.manual_discount_amount,0));
  v_discount_base := greatest(0,coalesce(v_order.discount,0)-v_old_manual);
  v_new_manual := least(
    round(greatest(0,coalesce(p_manual_discount_amount,0))),
    greatest(0,coalesce(v_order.subtotal,0)-v_discount_base)
  );
  v_new_discount := v_discount_base+v_new_manual;
  v_new_total := greatest(0,coalesce(v_order.subtotal,0)-v_new_discount)+greatest(0,coalesce(v_order.shipping_fee,0));

  update public.orders
     set manual_discount_amount=v_new_manual,
         discount=v_new_discount,
         discount_amount=v_new_discount,
         total=v_new_total,
         cod_balance_due=case
           when lower(coalesce(payment_method,''))='cod'
             then greatest(0,v_new_total-coalesce(cod_advance_paid,0)-coalesce(manual_payment_amount,0))
           else coalesce(cod_balance_due,0)
         end,
         updated_at=now()
   where id=v_order.id;

  if v_order.invoice_number is not null and v_order.invoice_data is not null
     and lower(coalesce(v_order.invoice_status,'active')) <> 'cancelled' then
    v_invoice := v_order.invoice_data
      || jsonb_build_object(
        'subtotal',coalesce(v_order.subtotal,0),
        'discount',v_new_discount,
        'shipping_fee',coalesce(v_order.shipping_fee,0),
        'total',v_new_total,
        'taxable_amount',greatest(0,coalesce(v_order.subtotal,0)-v_new_discount)+greatest(0,coalesce(v_order.shipping_fee,0)),
        'manual_discount_amount',v_new_manual
      );
    update public.orders set invoice_data=v_invoice where id=v_order.id;
    v_invoice_updated := true;
  end if;

  return jsonb_build_object(
    'success',true,'order_id',v_order.id,'order_number',v_order.order_number,
    'manual_discount_amount',v_new_manual,'discount',v_new_discount,
    'total',v_new_total,'invoice_updated',v_invoice_updated,
    'invoice_number',case when v_invoice_updated then v_order.invoice_number else null end
  );
end;
$$;

revoke all on function public.admin_update_order_extra_discount(uuid,numeric,text) from public, anon;
grant execute on function public.admin_update_order_extra_discount(uuid,numeric,text) to authenticated;
