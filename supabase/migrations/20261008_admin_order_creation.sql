-- Admin-created orders / social-media order intake
-- Applied to the Suru Collection Supabase project on 2026-10-08.

alter table public.orders
  add column if not exists order_source text not null default 'website';

update public.orders
set order_source='website'
where order_source is null or btrim(order_source)='';

create index if not exists orders_order_source_idx
  on public.orders(order_source);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='orders_order_source_check'
      and conrelid='public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_source_check
      check (order_source = any (array[
        'website','whatsapp','instagram','facebook','tiktok','phone','admin','other'
      ]));
  end if;
end $$;

create or replace function public.admin_create_order(
  p_customer_id uuid default null,
  p_customer jsonb default '{}'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_payment_method text default 'cod',
  p_customer_note text default null,
  p_coupon_code text default null,
  p_order_source text default 'admin',
  p_save_address boolean default true,
  p_address_label text default 'Home',
  p_address_is_default boolean default false,
  p_amount_paid numeric default 0,
  p_payment_reference text default null,
  p_preorder_balance_method text default 'cod'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_sizes%rowtype;
  v_variant_found boolean;
  v_code text;
  v_size text;
  v_color text;
  v_qty integer;
  v_stock integer := 0;
  v_unit_price numeric(12,2);
  v_regular_line numeric(12,2);
  v_preorder_discount numeric(12,2);
  v_final_line numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_preorder_discount_total numeric(12,2) := 0;
  v_coupon_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_preorder_advance_total numeric(12,2) := 0;
  v_advance_required numeric(12,2) := 0;
  v_amount_paid numeric(12,2) := greatest(0, round(coalesce(p_amount_paid,0)));
  v_balance_due numeric(12,2) := 0;
  v_advance_percent numeric(12,2);
  v_ncm_destination_branch text;
  v_coupon public.discount_coupons%rowtype;
  v_coupon_code text := nullif(trim(p_coupon_code),'');
  v_has_preorder boolean := false;
  v_save_address boolean := coalesce(p_save_address,true);
  v_make_default boolean := false;
  v_full_name text := nullif(trim(p_customer->>'name'),'');
  v_phone text := nullif(trim(p_customer->>'phone'),'');
  v_email text := nullif(trim(p_customer->>'email'),'');
  v_address text := nullif(trim(p_customer->>'address'),'');
  v_city text := nullif(trim(p_customer->>'city'),'');
  v_district text := nullif(trim(p_customer->>'district'),'');
  v_province text := nullif(trim(p_customer->>'province'),'');
  v_postal_code text := nullif(trim(p_customer->>'postal_code'),'');
  v_label text := coalesce(nullif(trim(p_address_label),''),'Home');
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if lower(trim(coalesce(p_order_source,''))) not in (
    'whatsapp','instagram','facebook','tiktok','phone','admin','other'
  ) then
    raise exception 'Invalid admin order source';
  end if;

  if lower(trim(coalesce(p_payment_method,''))) not in ('cod','fonepay','online') then
    raise exception 'Invalid payment method for admin-created order';
  end if;

  if lower(trim(coalesce(p_preorder_balance_method,''))) not in ('cod','online') then
    raise exception 'Invalid preorder balance method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Order must contain at least one item';
  end if;

  if v_full_name is null or v_phone is null or v_address is null or v_city is null then
    raise exception 'Customer name, phone, address and city are required';
  end if;

  if v_amount_paid < 0 then
    v_amount_paid := 0;
  end if;

  v_ncm_destination_branch := nullif(trim(p_customer->>'ncm_destination_branch'),'');
  if p_customer_id is not null then
    select id
      into v_customer_id
      from public.customers
     where id=p_customer_id
       and is_active=true
     for update;

    if not found then
      raise exception 'Selected customer was not found or is inactive';
    end if;

    update public.customers
       set name=v_full_name,
           phone=v_phone,
           email=v_email,
           first_name=coalesce(nullif(trim(p_customer->>'first_name'),''),first_name),
           last_name=coalesce(nullif(trim(p_customer->>'last_name'),''),last_name),
           ncm_destination_branch=coalesce(v_ncm_destination_branch,ncm_destination_branch),
           updated_at=now()
     where id=v_customer_id;
  else
    insert into public.customers(
      name,phone,email,address,city,district,province,postal_code,
      ncm_destination_branch,first_name,last_name,is_active
    )
    values(
      v_full_name,v_phone,v_email,v_address,v_city,v_district,v_province,v_postal_code,
      v_ncm_destination_branch,
      coalesce(nullif(trim(p_customer->>'first_name'),''),split_part(v_full_name,' ',1)),
      nullif(trim(coalesce(p_customer->>'last_name','')),''),
      true
    )
    returning id into v_customer_id;
  end if;

  if v_save_address then
    if v_province is null or v_district is null then
      raise exception 'Province and district are required for a saved delivery address';
    end if;

    v_make_default := p_address_is_default
      or not exists (
        select 1 from public.customer_addresses
        where customer_id=v_customer_id and is_default=true
      );

    if v_make_default then
      update public.customer_addresses
         set is_default=false,updated_at=now()
       where customer_id=v_customer_id;
    end if;

    insert into public.customer_addresses(
      customer_id,label,full_name,phone,address,city,district,province,
      postal_code,is_default,updated_at
    )
    values(
      v_customer_id,v_label,v_full_name,v_phone,v_address,v_city,v_district,v_province,
      v_postal_code,v_make_default,now()
    );

    if v_make_default then
      update public.customers
         set address=v_address,
             city=v_city,
             district=v_district,
             province=v_province,
             postal_code=v_postal_code,
             ncm_destination_branch=coalesce(v_ncm_destination_branch,ncm_destination_branch),
             updated_at=now()
       where id=v_customer_id;
    end if;
  end if;

  if v_coupon_code is not null then
    select *
      into v_coupon
      from public.discount_coupons
     where lower(code)=lower(v_coupon_code)
     for update;

    if not found or not v_coupon.is_active then
      raise exception 'Invalid or inactive coupon code';
    end if;
    if v_coupon.starts_at is not null and now()<v_coupon.starts_at then
      raise exception 'This coupon is not active yet';
    end if;
    if v_coupon.ends_at is not null and now()>v_coupon.ends_at then
      raise exception 'This coupon has expired';
    end if;
    if v_coupon.max_orders is not null and v_coupon.used_orders>=v_coupon.max_orders then
      raise exception 'This coupon has reached its total usage limit';
    end if;
    if v_coupon.max_orders_per_customer is not null
       and (
         select count(*)
           from public.coupon_redemptions
          where coupon_id=v_coupon.id and customer_id=v_customer_id
       ) >= v_coupon.max_orders_per_customer then
      raise exception 'This customer has reached the usage limit for this coupon';
    end if;
  end if;

  insert into public.orders(
    customer_id,customer_name,customer_phone,customer_email,
    shipping_address,city,district,province,postal_code,
    ncm_destination_branch,payment_method,customer_note,
    coupon_code,coupon_discount_percent,coupon_free_shipping,
    order_source
  )
  values(
    v_customer_id,v_full_name,v_phone,v_email,
    v_address,v_city,v_district,v_province,v_postal_code,
    v_ncm_destination_branch,lower(trim(p_payment_method)),
    nullif(trim(p_customer_note),''),
    case when v_coupon_code is null then null else v_coupon.code end,
    coalesce(v_coupon.discount_percent,0),
    coalesce(v_coupon.free_shipping,false),
    lower(trim(p_order_source))
  )
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code := upper(trim(v_item->>'code'));
    v_size := nullif(trim(v_item->>'size'),'');
    v_color := nullif(trim(v_item->>'color'),'');
    v_qty := coalesce((v_item->>'qty')::integer,0);

    if v_code is null or v_qty < 1 or v_qty > 10000 then
      raise exception 'Each item requires a valid product code and quantity';
    end if;

    select *
      into v_product
      from public.products
     where upper(product_code)=v_code
       and is_active=true
     for update;

    if not found then
      raise exception 'Product % is unavailable',v_code;
    end if;

    v_variant_found := false;

    if v_size is not null and v_color is not null then
      select *
        into v_variant
        from public.product_sizes
       where product_id=v_product.id
         and is_active=true
         and upper(coalesce(size,''))=upper(v_size)
         and upper(coalesce(color,''))=upper(v_color)
       order by id
       limit 1
       for update;
      v_variant_found := found;

      if not v_variant_found then
        select *
          into v_variant
          from public.product_sizes
         where product_id=v_product.id
           and is_active=true
           and upper(coalesce(size,''))=upper(v_size)
           and color is null
         order by id
         limit 1
         for update;
        v_variant_found := found;
      end if;
    elsif v_size is not null then
      select *
        into v_variant
        from public.product_sizes
       where product_id=v_product.id
         and is_active=true
         and upper(coalesce(size,''))=upper(v_size)
         and color is null
       order by id
       limit 1
       for update;
      v_variant_found := found;
    elsif v_color is not null then
      select *
        into v_variant
        from public.product_sizes
       where product_id=v_product.id
         and is_active=true
         and size is null
         and upper(coalesce(color,''))=upper(v_color)
       order by id
       limit 1
       for update;
      v_variant_found := found;
    else
      select *
        into v_variant
        from public.product_sizes
       where product_id=v_product.id
         and is_active=true
         and size is null
         and color is null
       order by id
       limit 1
       for update;
      v_variant_found := found;
    end if;

    if not v_variant_found then
      raise exception 'Selected variant is unavailable for %',v_code;
    end if;

    v_stock := coalesce(v_variant.stock,0);
    v_unit_price := coalesce(v_product.price,0);

    if coalesce((v_item->>'is_preorder')::boolean,false) then
      v_has_preorder := true;

      if v_stock >= v_qty then
        raise exception 'Preorder is only allowed when selected stock is unavailable for %',v_code;
      end if;

      if not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then
        raise exception 'Preorder is not enabled for %',v_code;
      end if;

      v_advance_percent := coalesce(
        v_variant.preorder_advance_percent,
        v_product.preorder_advance_percent
      );

      if v_advance_percent is null then
        select preorder_advance_percent
          into v_advance_percent
          from public.invoice_settings
         where id=true
         limit 1;
      end if;

      v_advance_percent := coalesce(v_advance_percent,30);
      if v_advance_percent<1 or v_advance_percent>100 then
        raise exception 'Invalid preorder advance configuration for %',v_code;
      end if;

      v_regular_line := round(v_unit_price*v_qty);
      v_preorder_discount := round(v_regular_line*0.05);
      v_final_line := round(v_regular_line-v_preorder_discount);
      v_preorder_discount_total := v_preorder_discount_total+v_preorder_discount;
      v_preorder_advance_total := v_preorder_advance_total+round(v_final_line*v_advance_percent/100);
      v_subtotal := v_subtotal+v_regular_line;

      insert into public.order_items(
        order_id,product_id,product_code,product_name,size,color,quantity,
        unit_price,total_price,is_preorder,preorder_discount,advance_amount,
        balance_amount,preorder_status,preorder_balance_method,
        advance_payment_status,advance_payment_gateway,advance_payment_reference,
        advance_payment_note
      )
      values(
        v_order_id,v_product.id,v_product.product_code,v_product.name,
        v_variant.size,v_variant.color,v_qty,v_unit_price,v_final_line,
        true,v_preorder_discount,
        round(v_final_line*v_advance_percent/100),
        greatest(0,v_final_line-round(v_final_line*v_advance_percent/100)),
        'awaiting_advance',lower(trim(p_preorder_balance_method)),
        'pending',
        case when v_amount_paid>0 then 'admin_manual' else null end,
        nullif(trim(p_payment_reference),''),
        case when v_amount_paid>0 then 'Advance payment recorded by admin.' else null end
      );
    else
      if v_stock < v_qty then
        raise exception 'Only % item(s) available for %',v_stock,v_code;
      end if;

      update public.product_sizes
         set stock=stock-v_qty
       where id=v_variant.id;

      v_regular_line := round(v_unit_price*v_qty);
      v_subtotal := v_subtotal+v_regular_line;

      insert into public.order_items(
        order_id,product_id,product_code,product_name,size,color,quantity,
        unit_price,total_price
      )
      values(
        v_order_id,v_product.id,v_product.product_code,v_product.name,
        v_variant.size,v_variant.color,v_qty,v_unit_price,v_regular_line
      );

      insert into public.inventory_movements(
        product_id,size_id,quantity_change,reason,reference_id
      )
      values(v_product.id,v_variant.id,-v_qty,'admin_order',v_order_id);
    end if;
  end loop;

  if v_coupon_code is not null then
    v_coupon_discount := round(
      greatest(0,v_subtotal-v_preorder_discount_total)
      * v_coupon.discount_percent/100
    );
    if v_coupon.max_discount_amount is not null then
      v_coupon_discount := least(v_coupon_discount,round(v_coupon.max_discount_amount));
    end if;

    update public.discount_coupons
       set used_orders=used_orders+1,updated_at=now()
     where id=v_coupon.id;

    insert into public.coupon_redemptions(
      coupon_id,order_id,customer_id,discount_amount,free_shipping
    )
    values(
      v_coupon.id,v_order_id,v_customer_id,v_coupon_discount,v_coupon.free_shipping
    );
  end if;

  v_total := round(greatest(0,v_subtotal-v_preorder_discount_total-v_coupon_discount));

  if v_has_preorder then
    v_advance_required := least(v_total,v_preorder_advance_total);
  elsif lower(trim(p_payment_method))='cod' then
    if v_ncm_destination_branch is null then
      raise exception 'Please select an NCM delivery branch for COD orders';
    end if;

    select least(
      v_total,
      round(coalesce(r.ncm_charge,0)+coalesce(r.door_pickup_charge,15))
    )
      into v_advance_required
      from public.ncm_delivery_rate_cache r
     where upper(trim(r.origin_branch))='GAUR'
       and upper(trim(r.destination_branch))=upper(trim(v_ncm_destination_branch))
       and r.delivery_type='Pickup/Collect'
       and r.expires_at>now()
     order by r.fetched_at desc
     limit 1;

    if not found then
      raise exception 'NCM door-to-door delivery rate is unavailable for the selected branch. Please refresh the delivery charge and try again';
    end if;
  else
    v_advance_required := 0;
  end if;

  if v_amount_paid > v_total then
    v_amount_paid := v_total;
  end if;

  v_balance_due := greatest(0,v_total-v_amount_paid);

  update public.orders
     set subtotal=v_subtotal,
         discount=round(v_preorder_discount_total+v_coupon_discount),
         discount_amount=round(v_preorder_discount_total+v_coupon_discount),
         shipping_fee=0,
         total=v_total,
         payment_status=case
           when v_amount_paid>=v_total then 'paid'
           else 'pending'
         end,
         order_status=case
           when v_has_preorder and v_amount_paid>=v_advance_required then 'confirmed'
           when not v_has_preorder and lower(trim(p_payment_method))='cod' and v_amount_paid>=v_advance_required then 'confirmed'
           when not v_has_preorder and lower(trim(p_payment_method)) in ('fonepay','online') and v_amount_paid>=v_total then 'confirmed'
           else 'pending'
         end,
         cod_advance_required=case
           when v_advance_required>0 then v_advance_required else 0
         end,
         cod_advance_paid=case
           when v_advance_required>0 then least(v_amount_paid,v_advance_required) else 0
         end,
         cod_balance_due=case
           when (v_has_preorder and lower(trim(p_preorder_balance_method))='cod')
                or (not v_has_preorder and lower(trim(p_payment_method))='cod')
             then v_balance_due
           else 0
         end,
         cod_advance_payment_status=case
           when v_advance_required=0 then 'not_required'
           when v_amount_paid>=v_advance_required then 'paid'
           else 'pending'
         end,
         cod_advance_fonepay_reference=case
           when lower(trim(p_payment_method))='cod' then nullif(trim(p_payment_reference),'')
           else null
         end,
         fonepay_reference=case
           when lower(trim(p_payment_method))='fonepay' then nullif(trim(p_payment_reference),'')
           else null
         end,
         updated_at=now()
   where id=v_order_id;

  update public.order_items
     set advance_payment_status=case
           when v_has_preorder and v_amount_paid>=v_preorder_advance_total then 'verified'
           else advance_payment_status
         end,
         preorder_status=case
           when v_has_preorder and v_amount_paid>=v_preorder_advance_total then 'confirmed'
           else preorder_status
         end,
         advance_payment_verified_at=case
           when v_has_preorder and v_amount_paid>=v_preorder_advance_total then now()
           else advance_payment_verified_at
         end,
         advance_payment_verified_by=case
           when v_has_preorder and v_amount_paid>=v_preorder_advance_total then v_admin_id
           else advance_payment_verified_by
         end,
         advance_payment_note=case
           when v_has_preorder and v_amount_paid>=v_preorder_advance_total then 'Advance recorded and verified by admin.'
           else advance_payment_note
         end
   where order_id=v_order_id
     and is_preorder=true;

  if lower(trim(p_payment_method))='fonepay' and v_amount_paid>=v_total then
    update public.orders
       set fonepay_paid_at=now(),fonepay_status='paid'
     where id=v_order_id;
  end if;

  if lower(trim(p_payment_method))='cod'
     and v_amount_paid>=v_advance_required
     and v_advance_required>0 then
    update public.orders
       set cod_advance_fonepay_paid_at=now()
     where id=v_order_id;
  end if;

  return jsonb_build_object(
    'success',true,
    'order_id',v_order_id,
    'order_number',v_order_number,
    'customer_id',v_customer_id,
    'subtotal',v_subtotal,
    'discount',round(v_preorder_discount_total+v_coupon_discount),
    'total',v_total,
    'amount_paid',v_amount_paid,
    'advance_required',v_advance_required,
    'balance_due',v_balance_due,
    'payment_method',lower(trim(p_payment_method)),
    'order_source',lower(trim(p_order_source)),
    'preorder',v_has_preorder,
    'preorder_advance_total',v_preorder_advance_total
  );
end;
$function$;

revoke execute on function public.admin_create_order(uuid,jsonb,jsonb,text,text,text,text,boolean,text,boolean,numeric,text,text) from public,anon;
grant execute on function public.admin_create_order(uuid,jsonb,jsonb,text,text,text,text,boolean,text,boolean,numeric,text,text) to authenticated;
