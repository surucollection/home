-- Remove delivery map/geolocation support. Delivery is address-only.
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text DEFAULT 'cod'::text,
  p_customer_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_customer_id uuid;
  v_auth_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_size_id uuid;
  v_stock integer;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_name text;
  v_code text;
  v_size text;
  v_color text;
  v_total numeric(12,2);
begin
  if p_payment_method not in ('cod','esewa','khalti','fonepay','online') then
    raise exception 'Invalid payment method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if coalesce(trim(p_customer->>'name'),'') = ''
     or coalesce(trim(p_customer->>'phone'),'') = ''
     or coalesce(trim(p_customer->>'address'),'') = ''
     or coalesce(trim(p_customer->>'city'),'') = '' then
    raise exception 'Customer details are incomplete';
  end if;

  if v_auth_user_id is not null then
    select id into v_customer_id
    from public.customers
    where auth_user_id = v_auth_user_id
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers(
      auth_user_id,name,phone,email,address,city,district,province,postal_code
    )
    values(
      v_auth_user_id,
      trim(p_customer->>'name'),
      trim(p_customer->>'phone'),
      nullif(trim(p_customer->>'email'),''),
      trim(p_customer->>'address'),
      trim(p_customer->>'city'),
      nullif(trim(p_customer->>'district'),''),
      nullif(trim(p_customer->>'province'),''),
      nullif(trim(p_customer->>'postal_code'),'')
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      name=trim(p_customer->>'name'),
      phone=trim(p_customer->>'phone'),
      email=nullif(trim(p_customer->>'email'),''),
      address=trim(p_customer->>'address'),
      city=trim(p_customer->>'city'),
      district=nullif(trim(p_customer->>'district'),''),
      province=nullif(trim(p_customer->>'province'),''),
      postal_code=nullif(trim(p_customer->>'postal_code'),''),
      updated_at=now()
    where id=v_customer_id;
  end if;

  insert into public.orders(
    customer_id,customer_name,customer_phone,customer_email,
    shipping_address,city,district,province,postal_code,
    payment_method,customer_note
  )
  values(
    v_customer_id,
    trim(p_customer->>'name'),
    trim(p_customer->>'phone'),
    nullif(trim(p_customer->>'email'),''),
    trim(p_customer->>'address'),
    trim(p_customer->>'city'),
    nullif(trim(p_customer->>'district'),''),
    nullif(trim(p_customer->>'province'),''),
    nullif(trim(p_customer->>'postal_code'),''),
    p_payment_method,
    p_customer_note
  )
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code:=upper(trim(v_item->>'code'));
    v_size:=nullif(trim(v_item->>'size'),'');
    v_color:=nullif(trim(v_item->>'color'),'');
    v_qty:=greatest(1,coalesce((v_item->>'qty')::integer,1));

    select * into v_product
    from public.products
    where upper(product_code)=v_code and is_active=true
    for update;

    if not found then raise exception 'Product % is unavailable',v_code; end if;

    v_name:=v_product.name;
    v_unit_price:=v_product.price;
    v_size_id:=null;
    v_stock:=null;

    if v_size is not null and v_color is not null then
      select id,stock into v_size_id,v_stock
      from public.product_sizes
      where product_id=v_product.id and is_active=true
        and upper(coalesce(size,''))=upper(v_size)
        and upper(coalesce(color,''))=upper(v_color)
      order by id limit 1 for update;

      if not found then
        select id,stock into v_size_id,v_stock
        from public.product_sizes
        where product_id=v_product.id and is_active=true
          and upper(coalesce(size,''))=upper(v_size)
          and color is null
        order by id limit 1 for update;
      end if;
    elsif v_size is not null then
      select id,stock into v_size_id,v_stock
      from public.product_sizes
      where product_id=v_product.id and is_active=true
        and upper(coalesce(size,''))=upper(v_size)
        and color is null
      order by id limit 1 for update;
    elsif v_color is not null then
      select id,stock into v_size_id,v_stock
      from public.product_sizes
      where product_id=v_product.id and is_active=true
        and size is null
        and upper(coalesce(color,''))=upper(v_color)
      order by id limit 1 for update;

      if not found and upper(coalesce(v_product.color,''))=upper(v_color) then
        select id,stock into v_size_id,v_stock
        from public.product_sizes
        where product_id=v_product.id and is_active=true
          and size is null and color is null
        order by id limit 1 for update;
      end if;
    else
      select id,stock into v_size_id,v_stock
      from public.product_sizes
      where product_id=v_product.id and is_active=true
        and size is null and color is null
      order by id limit 1 for update;
    end if;

    if not found then raise exception 'Selected variant is unavailable for %',v_code; end if;
    if coalesce(v_stock,0)<v_qty then
      raise exception 'Only % item(s) available for %',coalesce(v_stock,0),v_code;
    end if;

    update public.product_sizes set stock=stock-v_qty where id=v_size_id;
    v_total:=v_unit_price*v_qty;
    v_subtotal:=v_subtotal+v_total;

    insert into public.order_items(
      order_id,product_id,product_code,product_name,size,color,
      quantity,unit_price,total_price
    )
    values(
      v_order_id,v_product.id,v_product.product_code,v_name,v_size,v_color,
      v_qty,v_unit_price,v_total
    );

    insert into public.inventory_movements(
      product_id,size_id,quantity_change,reason,reference_id
    )
    values(v_product.id,v_size_id,-v_qty,'order',v_order_id);
  end loop;

  update public.orders
  set subtotal=v_subtotal,total=v_subtotal
  where id=v_order_id;

  return jsonb_build_object(
    'success',true,
    'order_id',v_order_id,
    'order_number',v_order_number,
    'subtotal',v_subtotal,
    'total',v_subtotal
  );
end;
$function$;

DROP FUNCTION IF EXISTS public.place_order_with_location(
  jsonb,jsonb,text,text,double precision,double precision,text
);

ALTER TABLE public.customers
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS location_address,
  DROP COLUMN IF EXISTS location_updated_at;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS delivery_latitude,
  DROP COLUMN IF EXISTS delivery_longitude,
  DROP COLUMN IF EXISTS delivery_location_address;
