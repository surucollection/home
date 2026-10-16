CREATE OR REPLACE FUNCTION public.admin_add_products_to_order(p_order_id uuid, p_items jsonb, p_manual_discount_amount numeric DEFAULT NULL::numeric, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant public.product_sizes%rowtype;
  v_qty integer;
  v_added_subtotal numeric(12,2) := 0;
  v_new_subtotal numeric(12,2);
  v_base_discount numeric(12,2);
  v_manual_discount numeric(12,2);
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_items jsonb;
  v_invoice jsonb;
  v_invoice_updated boolean := false;
  v_old_manual numeric(12,2);
  v_paid numeric(12,2);
  v_balance numeric(12,2);
  v_new_item_id uuid;
  v_started_at timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Enter a change reason (3–500 characters)';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if lower(coalesce(v_order.order_status,'')) not in ('pending','confirmed','processing','packed')
     and not (lower(coalesce(v_order.order_status,''))='shipped' and v_order.ncm_order_id is not null
       and lower(coalesce(v_order.ncm_status,'')) ~ '(cancelled|canceled)') then
    raise exception 'Products can only be added before shipment or delivery';
  end if;
  if v_order.inventory_released_at is not null then
    raise exception 'Inventory for this order has already been released. The order cannot be edited.';
  end if;
  if exists(select 1 from public.order_items oi where oi.order_id=v_order.id and oi.is_preorder=true) then
    raise exception 'Adding stocked products to an order containing preorder items is not supported in this edit flow.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_line->>'quantity')::integer,0);
    if v_qty < 1 or v_qty > 100 then raise exception 'Quantity must be between 1 and 100'; end if;

    select * into v_product from public.products
      where id=(v_line->>'product_id')::uuid and is_active=true for update;
    if not found then raise exception 'A selected product is unavailable'; end if;

    select * into v_variant from public.product_sizes
      where id=(v_line->>'variant_id')::uuid and product_id=v_product.id and is_active=true
      for update;
    if not found then raise exception 'A selected size/colour is no longer available'; end if;
    if coalesce(v_variant.stock,0) < v_qty then
      raise exception 'Only % item(s) are available for %',coalesce(v_variant.stock,0),v_product.product_code;
    end if;

    update public.product_sizes set stock=stock-v_qty where id=v_variant.id;
    insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id)
      values(v_product.id,v_variant.id,-v_qty,'admin_order_add_item',v_order.id);

    insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price,is_preorder)
      values(v_order.id,v_product.id,v_product.product_code,v_product.name,v_variant.size,v_variant.color,
        v_qty,round(coalesce(v_product.price,0)),round(coalesce(v_product.price,0)*v_qty),false)
      returning id into v_new_item_id;

    insert into public.order_item_edit_history(
      order_id,order_item_id,product_id,changed_by,old_size,old_color,new_size,new_color,
      reason,invoice_updated,invoice_number,ncm_order_id,ncm_unchanged
    ) values (
      v_order.id,v_new_item_id,v_product.id,auth.uid(),null,null,v_variant.size,v_variant.color,
      trim(p_reason),false,null,v_order.ncm_order_id,v_order.ncm_order_id is not null
    );

    v_added_subtotal := v_added_subtotal + round(coalesce(v_product.price,0)*v_qty);
  end loop;

  v_new_subtotal := round(coalesce(v_order.subtotal,0)+v_added_subtotal);
  v_old_manual := greatest(0,coalesce(v_order.manual_discount_amount,0));
  v_base_discount := greatest(0,coalesce(v_order.discount,0)-v_old_manual);
  v_manual_discount := least(
    round(greatest(0,coalesce(p_manual_discount_amount,v_old_manual))),
    greatest(0,v_new_subtotal-v_base_discount)
  );
  v_discount := v_base_discount+v_manual_discount;
  v_total := greatest(0,v_new_subtotal-v_discount)+greatest(0,coalesce(v_order.shipping_fee,0));
  v_paid := greatest(0,coalesce(v_order.cod_advance_paid,0))
          + greatest(0,coalesce(v_order.manual_payment_amount,0));
  v_balance := greatest(0,v_total-v_paid);

  update public.orders set
    subtotal=v_new_subtotal,
    manual_discount_amount=v_manual_discount,
    discount=v_discount,
    discount_amount=v_discount,
    total=v_total,
    cod_balance_due=case when lower(coalesce(payment_method,''))='cod' then v_balance else cod_balance_due end,
    payment_status=case when v_total>coalesce(v_order.total,0) and lower(coalesce(v_order.payment_status,''))='paid' then 'pending' else v_order.payment_status end,
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
   where order_id=v_order.id and changed_by=auth.uid() and created_at>=v_started_at;

  return jsonb_build_object('success',true,'order_id',v_order.id,'order_number',v_order.order_number,
    'added_subtotal',v_added_subtotal,'subtotal',v_new_subtotal,'discount',v_discount,
    'manual_discount_amount',v_manual_discount,'total',v_total,'balance_due',v_balance,
    'invoice_updated',v_invoice_updated,'invoice_number',case when v_invoice_updated then v_order.invoice_number else null end);
end;
$function$
;
