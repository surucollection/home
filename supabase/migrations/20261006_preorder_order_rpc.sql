create or replace function public.place_preorder_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'online',
  p_customer_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_auth_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_sizes%rowtype;
  v_code text;
  v_size text;
  v_color text;
  v_qty integer;
  v_advance_percent numeric;
  v_regular_line numeric(12,2);
  v_discount numeric(12,2);
  v_final_line numeric(12,2);
  v_advance numeric(12,2);
  v_balance numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_advance_total numeric(12,2) := 0;
  v_destination text;
begin
  if p_payment_method not in ('esewa','khalti','fonepay','online') then
    raise exception 'Preorders require an online advance payment method';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Preorder cart is empty';
  end if;
  if coalesce(trim(p_customer->>'name'),'') = ''
     or coalesce(trim(p_customer->>'phone'),'') = ''
     or coalesce(trim(p_customer->>'address'),'') = ''
     or coalesce(trim(p_customer->>'city'),'') = '' then
    raise exception 'Customer details are incomplete';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) as x(item)
             where coalesce(item->>'qty','') !~ '^[1-9][0-9]{0,3}$') then
    raise exception 'Each preorder quantity must be a positive whole number';
  end if;

  v_destination := nullif(trim(p_customer->>'ncm_destination_branch'),'');
  if v_auth_user_id is not null then
    select id into v_customer_id from public.customers where auth_user_id = v_auth_user_id limit 1;
  end if;
  if v_customer_id is null then
    insert into public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code,ncm_destination_branch)
    values(v_auth_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),
      nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),
      nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),
      nullif(trim(p_customer->>'postal_code'),''),v_destination)
    returning id into v_customer_id;
  else
    update public.customers set name=trim(p_customer->>'name'), phone=trim(p_customer->>'phone'),
      email=nullif(trim(p_customer->>'email'),''), address=trim(p_customer->>'address'),
      city=trim(p_customer->>'city'), district=nullif(trim(p_customer->>'district'),''),
      province=nullif(trim(p_customer->>'province'),''), postal_code=nullif(trim(p_customer->>'postal_code'),''),
      ncm_destination_branch=coalesce(v_destination,ncm_destination_branch), updated_at=now()
    where id=v_customer_id;
    select ncm_destination_branch into v_destination from public.customers where id=v_customer_id;
  end if;

  insert into public.orders(customer_id,customer_name,customer_phone,customer_email,shipping_address,city,
    district,province,postal_code,ncm_destination_branch,payment_method,customer_note)
  values(v_customer_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),
    nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),
    nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),
    nullif(trim(p_customer->>'postal_code'),''),v_destination,p_payment_method,p_customer_note)
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code := upper(trim(v_item->>'code'));
    v_size := nullif(trim(v_item->>'size'),'');
    v_color := nullif(trim(v_item->>'color'),'');
    v_qty := (v_item->>'qty')::integer;

    select * into v_product from public.products
      where upper(product_code)=v_code and is_active=true for update;
    if not found then raise exception 'Product % is unavailable',v_code; end if;

    select * into v_variant from public.product_sizes
      where product_id=v_product.id and is_active=true
        and (v_size is null or upper(size)=upper(v_size))
        and (v_color is null or upper(coalesce(color,''))=upper(v_color))
      order by id limit 1 for update;
    if not found then raise exception 'Selected variant is unavailable for %',v_code; end if;

    if not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then
      raise exception 'Preorder is not enabled for %',v_code;
    end if;
    v_advance_percent := coalesce(v_variant.preorder_advance_percent,v_product.preorder_advance_percent,30);
    if v_advance_percent < 1 or v_advance_percent > 100 then
      raise exception 'Invalid preorder advance configuration for %',v_code;
    end if;

    v_regular_line := round(v_product.price * v_qty,2);
    v_discount := round(v_regular_line * 0.05,2);
    v_final_line := v_regular_line-v_discount;
    v_advance := round(v_final_line*v_advance_percent/100,2);
    v_balance := v_final_line-v_advance;

    insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,
      unit_price,total_price,is_preorder,preorder_discount,advance_amount,balance_amount,preorder_status)
    values(v_order_id,v_product.id,v_product.product_code,v_product.name,v_variant.size,v_variant.color,
      v_qty,v_product.price,v_final_line,true,v_discount,v_advance,v_balance,'awaiting_advance');

    v_subtotal := v_subtotal+v_regular_line;
    v_discount_total := v_discount_total+v_discount;
    v_advance_total := v_advance_total+v_advance;
  end loop;

  update public.orders set subtotal=v_subtotal,discount=v_discount_total,
    discount_amount=v_discount_total,total=v_subtotal-v_discount_total, payment_status='pending'
  where id=v_order_id;

  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,
    'subtotal',v_subtotal,'discount',v_discount_total,'total',v_subtotal-v_discount_total,
    'advance_due',v_advance_total,'balance_due',v_subtotal-v_discount_total-v_advance_total,
    'payment_status','pending');
end;
$$;

revoke all on function public.place_preorder_order(jsonb,jsonb,text,text) from public;
grant execute on function public.place_preorder_order(jsonb,jsonb,text,text) to anon, authenticated;
