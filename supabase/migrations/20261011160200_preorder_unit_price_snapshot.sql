-- Snapshot the selling price used when a Fonepay preorder payment intent is created.
ALTER TABLE public.preorder_payment_intents
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) CHECK (unit_price IS NULL OR unit_price >= 0);

CREATE OR REPLACE FUNCTION public.create_preorder_payment_intent(p_user_id uuid, p_customer jsonb, p_product_code text, p_size text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_qty integer DEFAULT 1, p_balance_method text DEFAULT 'cod'::text, p_payment_method text DEFAULT 'fonepay'::text, p_customer_note text DEFAULT NULL::text, p_payment_purpose text DEFAULT 'cod_advance'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_customer_id uuid;
  v_product public.products%rowtype;
  v_variant public.product_sizes%rowtype;
  v_variant_found boolean;
  v_percent numeric;
  v_regular numeric(12,2);
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_advance numeric(12,2);
  v_balance numeric(12,2);
  v_intent uuid;
  v_destination text;
  v_shipping_fee numeric(12,2):=0;
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;
  if p_payment_purpose not in ('full','cod_advance') then raise exception 'Unsupported preorder payment option'; end if;
  if p_payment_purpose='cod_advance' and p_balance_method<>'cod' then raise exception 'COD preorder must use cash on delivery for the remaining balance'; end if;
  if p_payment_purpose='full' then p_balance_method:='paid'; end if;
  if p_payment_method<>'fonepay' then raise exception 'This payment method is not currently available for preorder'; end if;
  if coalesce(p_qty,0)<1 then raise exception 'Quantity must be at least 1'; end if;
  if coalesce(trim(p_customer->>'name'),'')='' or coalesce(trim(p_customer->>'phone'),'')='' or coalesce(trim(p_customer->>'address'),'')='' or coalesce(trim(p_customer->>'city'),'')='' or coalesce(trim(p_customer->>'district'),'')='' or coalesce(trim(p_customer->>'province'),'')='' then raise exception 'Customer details are incomplete'; end if;

  v_destination := nullif(trim(p_customer->>'ncm_destination_branch'),'');
  if v_destination is null then raise exception 'Please select an NCM delivery branch'; end if;

  select * into v_product
  from public.products
  where upper(product_code)=upper(trim(p_product_code))
    and is_active=true
    and preorder_enabled=true
  for update;

  if not found then raise exception 'Product is unavailable for preorder'; end if;

  select * into v_variant
  from public.product_sizes
  where product_id=v_product.id
    and is_active=true
    and (p_size is null or upper(size)=upper(p_size))
    and (p_color is null or upper(coalesce(color,''))=upper(p_color))
  order by case when upper(coalesce(color,''))=upper(coalesce(p_color,'')) then 0 else 1 end,id
  limit 1
  for update;

  v_variant_found:=found;
  if v_variant_found and coalesce(v_variant.stock,0)>0 then raise exception 'This option is in stock. Please use Buy Now instead'; end if;
  if v_variant_found and not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then raise exception 'Preorder is not enabled for this option'; end if;

  select coalesce(preorder_advance_percent,30) into v_percent
  from public.invoice_settings
  where id=true
  limit 1;

  v_percent:=coalesce(v_percent,30);
  if v_percent<1 or v_percent>100 then raise exception 'Invalid preorder advance configuration'; end if;

  select id into v_customer_id from public.customers where auth_user_id=p_user_id limit 1;
  if v_customer_id is null then
    insert into public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code,ncm_destination_branch)
    values(p_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(p_customer->>'district'),trim(p_customer->>'province'),nullif(trim(p_customer->>'postal_code'),''),v_destination)
    returning id into v_customer_id;
  else
    update public.customers
    set name=trim(p_customer->>'name'),
        phone=trim(p_customer->>'phone'),
        email=nullif(trim(p_customer->>'email'),''),
        address=trim(p_customer->>'address'),
        city=trim(p_customer->>'city'),
        district=trim(p_customer->>'district'),
        province=trim(p_customer->>'province'),
        postal_code=nullif(trim(p_customer->>'postal_code'),''),
        ncm_destination_branch=coalesce(v_destination,ncm_destination_branch),
        updated_at=now()
    where id=v_customer_id;
  end if;

  select round(coalesce(r.ncm_charge,0)+coalesce(r.door_pickup_charge,15))
    into v_shipping_fee
    from public.ncm_delivery_rate_cache r
   where upper(trim(r.origin_branch))='GAUR'
     and upper(trim(r.destination_branch))=upper(trim(v_destination))
     and r.delivery_type='Pickup/Collect'
     and r.expires_at>now()
   order by r.fetched_at desc
   limit 1;
  if not found then
    raise exception 'NCM delivery rate is unavailable for the selected branch. Please refresh the branch quote and try again';
  end if;

  v_regular:=round(v_product.price*p_qty);
  v_discount:=round(v_regular*0.05);
  v_total:=round(v_regular-v_discount)+v_shipping_fee;

  if p_payment_purpose='full' then
    v_advance:=v_total;
    v_balance:=0;
  else
    v_advance:=round(v_total*v_percent/100);
    v_balance:=round(v_total-v_advance);
  end if;

  insert into public.preorder_payment_intents(
    auth_user_id,customer_id,product_id,product_code,size,color,quantity,
    unit_price,total_amount,shipping_fee,advance_amount,balance_amount,advance_percent,balance_method,
    payment_method,payment_provider,payment_purpose,customer_snapshot,customer_note
  )
  values(
    p_user_id,v_customer_id,v_product.id,v_product.product_code,
    case when v_variant_found then v_variant.size else nullif(trim(p_size),'') end,
    case when v_variant_found then v_variant.color else nullif(trim(p_color),'') end,
    p_qty,v_product.price,v_total,v_shipping_fee,v_advance,v_balance,
    case when p_payment_purpose='full' then 100 else v_percent end,
    p_balance_method,p_payment_method,'fonepay',p_payment_purpose,
    jsonb_build_object(
      'name',trim(p_customer->>'name'),
      'phone',trim(p_customer->>'phone'),
      'email',nullif(trim(p_customer->>'email'),''),
      'address',trim(p_customer->>'address'),
      'city',trim(p_customer->>'city'),
      'district',trim(p_customer->>'district'),
      'province',trim(p_customer->>'province'),
      'postal_code',nullif(trim(p_customer->>'postal_code'),'')
    ),
    nullif(trim(coalesce(p_customer_note,'')),'')
  )
  returning id into v_intent;

  return jsonb_build_object(
    'success',true,
    'intent_id',v_intent,
    'amount',v_advance,
    'total',v_total,
    'shipping_fee',v_shipping_fee,
    'balance_due',v_balance,
    'advance_percent',case when p_payment_purpose='full' then 100 else v_percent end,
    'payment_purpose',p_payment_purpose
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_preorder_payment_intent(p_intent_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_intent public.preorder_payment_intents%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_regular numeric(12,2);
  v_discount numeric(12,2);
begin
  select * into v_intent
  from public.preorder_payment_intents
  where id=p_intent_id and auth_user_id=p_user_id
  for update;

  if not found then raise exception 'Preorder payment intent not found'; end if;
  if v_intent.payment_status<>'paid' then raise exception 'Payment is not verified'; end if;

  if v_intent.order_id is not null then
    return jsonb_build_object(
      'success',true,
      'already_finalized',true,
      'order_id',v_intent.order_id,
      'order_number',(select order_number from public.orders where id=v_intent.order_id)
    );
  end if;

  v_regular:=round(coalesce(v_intent.unit_price,(select price from public.products where id=v_intent.product_id))*v_intent.quantity);
  v_discount:=round(v_regular*0.05);

  insert into public.orders(
    customer_id,customer_name,customer_phone,customer_email,
    shipping_address,city,district,province,postal_code,
    ncm_destination_branch,
    payment_method,customer_note,subtotal,discount,discount_amount,shipping_fee,total,
    payment_status,order_status
  )
  select
    v_intent.customer_id,c.name,c.phone,c.email,
    c.address,c.city,c.district,c.province,c.postal_code,
    c.ncm_destination_branch,
    case when v_intent.payment_purpose='cod_advance' then 'cod' else 'fonepay' end,
    v_intent.customer_note,v_regular,v_discount,v_discount,coalesce(v_intent.shipping_fee,0),v_intent.total_amount,
    case when v_intent.payment_purpose='cod_advance' then 'pending' else 'paid' end,
    'confirmed'
  from public.customers c
  where c.id=v_intent.customer_id
  returning id,order_number into v_order_id,v_order_number;

  insert into public.order_items(
    order_id,product_id,product_code,product_name,size,color,quantity,
    unit_price,total_price,is_preorder,preorder_discount,advance_amount,
    balance_amount,preorder_status,preorder_balance_method,
    advance_payment_status,advance_payment_reference,advance_payment_verified_at,
    advance_payment_note
  )
  select
    v_order_id,v_intent.product_id,v_intent.product_code,p.name,v_intent.size,v_intent.color,
    v_intent.quantity,coalesce(v_intent.unit_price,p.price),(v_intent.total_amount-coalesce(v_intent.shipping_fee,0)),true,v_discount,v_intent.advance_amount,
    v_intent.balance_amount,'confirmed',v_intent.balance_method,'verified',
    v_intent.payment_reference,v_intent.paid_at,'Verified by Fonepay'
  from public.products p
  where p.id=v_intent.product_id;

  update public.orders
  set
    cod_advance_required=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,
    cod_advance_paid=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,
    cod_balance_due=case when v_intent.payment_purpose='cod_advance' then v_intent.balance_amount else 0 end,
    cod_advance_payment_status=case when v_intent.payment_purpose='cod_advance' then 'paid' else 'not_required' end
  where id=v_order_id;

  update public.preorder_payment_intents
  set order_id=v_order_id,finalized_at=now(),updated_at=now()
  where id=v_intent.id;

  return jsonb_build_object(
    'success',true,
    'order_id',v_order_id,
    'order_number',v_order_number,
    'advance_paid',v_intent.advance_amount,
    'balance_due',v_intent.balance_amount,
    'payment_purpose',v_intent.payment_purpose
  );
end;
$function$;
