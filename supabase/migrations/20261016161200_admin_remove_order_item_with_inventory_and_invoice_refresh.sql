create or replace function public.admin_remove_order_item(
  p_order_id uuid,
  p_order_item_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_variant public.product_sizes%rowtype;
  v_new_subtotal numeric(12,2);
  v_base_discount numeric(12,2);
  v_manual_discount numeric(12,2);
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_balance numeric(12,2);
  v_items jsonb;
  v_invoice jsonb;
  v_invoice_updated boolean := false;
  v_started_at timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Enter a change reason (3–500 characters)';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if lower(coalesce(v_order.order_status,'')) not in ('pending','confirmed','processing','packed')
     and not (lower(coalesce(v_order.order_status,''))='shipped' and v_order.ncm_order_id is not null
       and lower(coalesce(v_order.ncm_status,'')) ~ '(cancelled|canceled)') then
    raise exception 'Products can only be removed before shipment or delivery';
  end if;
  if v_order.inventory_released_at is not null then
    raise exception 'Inventory for this order has already been released. The order cannot be edited.';
  end if;
  select * into v_item from public.order_items where id=p_order_item_id and order_id=p_order_id for update;
  if not found then raise exception 'This product is no longer in the order'; end if;
  if coalesce(v_item.is_preorder,false) then raise exception 'Pre-order items cannot be removed through this stocked-order workflow.'; end if;
  if v_item.product_id is null then raise exception 'The product record is unavailable, so inventory cannot safely be restored.'; end if;
  if (select count(*) from public.order_items where order_id=p_order_id) <= 1 then
    raise exception 'An order must contain at least one product. Cancel the order instead if it should have no items.';
  end if;
  select * into v_variant from public.product_sizes
   where product_id=v_item.product_id
     and coalesce(size,'')=coalesce(v_item.size,'')
     and coalesce(color,'')=coalesce(v_item.color,'')
   order by is_active desc limit 1 for update;
  if not found then raise exception 'The original size/colour inventory record was not found. No changes were made.'; end if;
  update public.product_sizes set stock=coalesce(stock,0)+v_item.quantity where id=v_variant.id;
  insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id)
   values(v_item.product_id,v_variant.id,v_item.quantity,'admin_order_remove_item',v_order.id);
  insert into public.order_item_edit_history(
    order_id,order_item_id,product_id,changed_by,old_size,old_color,new_size,new_color,
    reason,invoice_updated,invoice_number,ncm_order_id,ncm_unchanged
  ) values (
    v_order.id,v_item.id,v_item.product_id,auth.uid(),v_item.size,v_item.color,null,null,
    'Removed product from order: '||trim(p_reason),false,null,v_order.ncm_order_id,v_order.ncm_order_id is not null
  );
  delete from public.order_items where id=v_item.id;
  select coalesce(sum(total_price),0) into v_new_subtotal from public.order_items where order_id=v_order.id;
  v_new_subtotal := round(v_new_subtotal);
  v_base_discount := greatest(0,coalesce(v_order.discount,0)-greatest(0,coalesce(v_order.manual_discount_amount,0)));
  v_manual_discount := least(greatest(0,round(coalesce(v_order.manual_discount_amount,0))),greatest(0,v_new_subtotal-v_base_discount));
  v_discount := v_base_discount+v_manual_discount;
  v_total := greatest(0,v_new_subtotal-v_discount)+greatest(0,coalesce(v_order.shipping_fee,0));
  v_paid := greatest(0,coalesce(v_order.cod_advance_paid,0))+greatest(0,coalesce(v_order.manual_payment_amount,0));
  v_balance := greatest(0,v_total-v_paid);
  update public.orders set
    subtotal=v_new_subtotal,
    manual_discount_amount=v_manual_discount,
    discount=v_discount,
    discount_amount=v_discount,
    total=v_total,
    cod_balance_due=case when lower(coalesce(payment_method,''))='cod' then v_balance else cod_balance_due end,
    payment_status=case when v_total<coalesce(v_order.total,0) and lower(coalesce(v_order.payment_status,''))='paid' and v_paid<v_total then 'pending' else v_order.payment_status end,
    updated_at=now()
  where id=v_order.id;
  if v_order.invoice_number is not null and v_order.invoice_data is not null
     and lower(coalesce(v_order.invoice_status,'active')) <> 'cancelled' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_code',oi.product_code,'product_name',oi.product_name,'size',oi.size,'color',oi.color,
      'quantity',oi.quantity,'unit_price',oi.unit_price,'total_price',oi.total_price
    ) order by oi.created_at,oi.id),'[]'::jsonb)
    into v_items from public.order_items oi where oi.order_id=v_order.id;
    v_invoice := v_order.invoice_data || jsonb_build_object(
      'items',v_items,'subtotal',v_new_subtotal,'discount',v_discount,
      'manual_discount_amount',v_manual_discount,'shipping_fee',coalesce(v_order.shipping_fee,0),
      'total',v_total,'taxable_amount',greatest(0,v_new_subtotal-v_discount)+greatest(0,coalesce(v_order.shipping_fee,0))
    );
    update public.orders set invoice_data=v_invoice where id=v_order.id;
    v_invoice_updated := true;
  end if;
  update public.order_item_edit_history
     set invoice_updated=v_invoice_updated,
         invoice_number=case when v_invoice_updated then v_order.invoice_number else null end
   where order_id=v_order.id and changed_by=auth.uid()
     and created_at>=v_started_at and reason='Removed product from order: '||trim(p_reason);
  return jsonb_build_object(
    'success',true,'order_id',v_order.id,'order_number',v_order.order_number,
    'removed_product',v_item.product_name,'removed_quantity',v_item.quantity,
    'subtotal',v_new_subtotal,'discount',v_discount,'manual_discount_amount',v_manual_discount,
    'total',v_total,'balance_due',v_balance,'invoice_updated',v_invoice_updated,
    'invoice_number',case when v_invoice_updated then v_order.invoice_number else null end,
    'ncm_order_id',v_order.ncm_order_id
  );
end;
$function$;
revoke all on function public.admin_remove_order_item(uuid,uuid,text) from public, anon;
grant execute on function public.admin_remove_order_item(uuid,uuid,text) to authenticated;
