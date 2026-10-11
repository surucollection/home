-- Centralized selling price formula and destination-specific shipping totals.
-- Existing product prices are not modified unless an admin records a base cost.
ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS product_markup_percent numeric(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_charge_per_item numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_delivery_charge numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_product_markup_percent_check;
ALTER TABLE public.invoice_settings ADD CONSTRAINT invoice_settings_product_markup_percent_check
  CHECK (product_markup_percent >= 0 AND product_markup_percent <= 500);
ALTER TABLE public.invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_packaging_charge_check;
ALTER TABLE public.invoice_settings ADD CONSTRAINT invoice_settings_packaging_charge_check
  CHECK (packaging_charge_per_item >= 0 AND packaging_charge_per_item <= 100000);
ALTER TABLE public.invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_default_delivery_charge_check;
ALTER TABLE public.invoice_settings ADD CONSTRAINT invoice_settings_default_delivery_charge_check
  CHECK (default_delivery_charge >= 0 AND default_delivery_charge <= 100000);

CREATE TABLE IF NOT EXISTS public.product_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  base_cost numeric(12,2) NOT NULL CHECK (base_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_costs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_costs TO authenticated;
DROP POLICY IF EXISTS product_costs_admin_all ON public.product_costs;
CREATE POLICY product_costs_admin_all ON public.product_costs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.recalculate_product_sale_price(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $function$
DECLARE v_base_cost numeric(12,2); v_markup numeric(7,2); v_packaging numeric(12,2);
BEGIN
  SELECT pc.base_cost INTO v_base_cost FROM public.product_costs pc WHERE pc.product_id=p_product_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT coalesce(s.product_markup_percent,0),coalesce(s.packaging_charge_per_item,0)
    INTO v_markup,v_packaging FROM public.invoice_settings s WHERE s.id=true LIMIT 1;
  UPDATE public.products
  SET price=round(v_base_cost*(1+coalesce(v_markup,0)/100)+coalesce(v_packaging,0))
  WHERE id=p_product_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.recalculate_product_sale_price(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_product_cost_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $function$
BEGIN
  PERFORM public.recalculate_product_sale_price(NEW.product_id);
  UPDATE public.product_costs SET updated_at=now() WHERE product_id=NEW.product_id;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_product_cost_price() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_product_cost_price ON public.product_costs;
CREATE TRIGGER trg_sync_product_cost_price
AFTER INSERT OR UPDATE OF base_cost ON public.product_costs
FOR EACH ROW EXECUTE FUNCTION public.sync_product_cost_price();

CREATE OR REPLACE FUNCTION public.reprice_products_after_setting_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $function$
DECLARE v_product record;
BEGIN
  IF TG_OP='UPDATE'
     AND OLD.product_markup_percent IS NOT DISTINCT FROM NEW.product_markup_percent
     AND OLD.packaging_charge_per_item IS NOT DISTINCT FROM NEW.packaging_charge_per_item THEN
    RETURN NEW;
  END IF;
  FOR v_product IN SELECT product_id FROM public.product_costs LOOP
    PERFORM public.recalculate_product_sale_price(v_product.product_id);
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.reprice_products_after_setting_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_reprice_products_after_setting_change ON public.invoice_settings;
CREATE TRIGGER trg_reprice_products_after_setting_change
AFTER INSERT OR UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.reprice_products_after_setting_change();

CREATE OR REPLACE FUNCTION public.get_store_pricing_settings()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'product_markup_percent',coalesce(s.product_markup_percent,0),
    'packaging_charge_per_item',coalesce(s.packaging_charge_per_item,0),
    'default_delivery_charge',coalesce(s.default_delivery_charge,0)
  )
  FROM public.invoice_settings s WHERE s.id=true LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.get_store_pricing_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_pricing_settings() TO anon, authenticated;

ALTER TABLE public.preorder_payment_intents
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.place_order(p_customer jsonb, p_items jsonb, p_payment_method text DEFAULT 'cod'::text, p_customer_note text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_checkout_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_customer_id uuid; v_auth_user_id uuid:=auth.uid(); v_order_id uuid; v_order_number text;
 v_subtotal numeric(12,2):=0; v_item jsonb; v_product public.products%rowtype; v_size_id uuid;
 v_stock integer; v_qty integer; v_unit_price numeric(12,2); v_name text; v_code text; v_size text; v_color text;
 v_total numeric(12,2); v_ncm_destination_branch text; v_coupon public.discount_coupons%rowtype;
 v_discount numeric(12,2):=0; v_final_total numeric(12,2):=0; v_customer_coupon_count integer:=0;
 v_existing public.orders%rowtype;
 v_checkout_key text:=nullif(trim(p_checkout_idempotency_key),'');
 v_coupon_code text:=nullif(trim(p_coupon_code),''); v_cod_advance numeric(12,2):=0; v_shipping_fee numeric(12,2):=0;
begin
 if p_payment_method not in ('cod','esewa','khalti','fonepay','online') then raise exception 'Invalid payment method'; end if;
 if v_checkout_key is not null and (length(v_checkout_key)>64 or v_checkout_key !~ '^[0-9a-fA-F-]{16,64}$') then raise exception 'Invalid checkout idempotency key'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
 if coalesce(trim(p_customer->>'name'),'')='' or coalesce(trim(p_customer->>'phone'),'')='' or coalesce(trim(p_customer->>'address'),'')='' or coalesce(trim(p_customer->>'city'),'')='' then raise exception 'Customer details are incomplete'; end if;
 v_ncm_destination_branch:=nullif(trim(p_customer->>'ncm_destination_branch'),'');
 if v_auth_user_id is not null then select id into v_customer_id from public.customers where auth_user_id=v_auth_user_id limit 1 for update; end if;
 if v_customer_id is null then
   insert into public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code,ncm_destination_branch)
   values(v_auth_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),nullif(trim(p_customer->>'postal_code'),''),v_ncm_destination_branch) returning id into v_customer_id;
 else
   update public.customers set name=trim(p_customer->>'name'),phone=trim(p_customer->>'phone'),email=nullif(trim(p_customer->>'email'),''),address=trim(p_customer->>'address'),city=trim(p_customer->>'city'),district=nullif(trim(p_customer->>'district'),''),province=nullif(trim(p_customer->>'province'),''),postal_code=nullif(trim(p_customer->>'postal_code'),''),ncm_destination_branch=coalesce(v_ncm_destination_branch,ncm_destination_branch),updated_at=now() where id=v_customer_id;
   select ncm_destination_branch into v_ncm_destination_branch from public.customers where id=v_customer_id;
 end if;
 if v_checkout_key is not null then
   select * into v_existing from public.orders where customer_id=v_customer_id and checkout_idempotency_key=v_checkout_key limit 1;
   if found then
     return jsonb_build_object('success',true,'duplicate',true,'order_id',v_existing.id,'order_number',v_existing.order_number,'subtotal',v_existing.subtotal,'discount',coalesce(v_existing.discount,0),'shipping_fee',coalesce(v_existing.shipping_fee,0),'total',v_existing.total,'coupon_code',v_existing.coupon_code,'free_shipping',coalesce(v_existing.coupon_free_shipping,false),'cod_advance_required',coalesce(v_existing.cod_advance_required,0),'cod_balance_due',coalesce(v_existing.cod_balance_due,0));
   end if;
 end if;
 if v_coupon_code is not null then
   select * into v_coupon from public.discount_coupons where lower(code)=lower(v_coupon_code) for update;
   if not found or not v_coupon.is_active then raise exception 'Invalid or inactive coupon code'; end if;
   if v_coupon.starts_at is not null and now()<v_coupon.starts_at then raise exception 'This coupon is not active yet'; end if;
   if v_coupon.ends_at is not null and now()>v_coupon.ends_at then raise exception 'This coupon has expired'; end if;
   if v_coupon.max_orders is not null and v_coupon.used_orders>=v_coupon.max_orders then raise exception 'This coupon has reached its total usage limit'; end if;
   if v_coupon.max_orders_per_customer is not null then
     select count(*) into v_customer_coupon_count from public.coupon_redemptions where coupon_id=v_coupon.id and customer_id=v_customer_id;
     if v_customer_coupon_count>=v_coupon.max_orders_per_customer then raise exception 'You have reached the usage limit for this coupon'; end if;
   end if;
 end if;
 insert into public.orders(customer_id,checkout_idempotency_key,customer_name,customer_phone,customer_email,shipping_address,city,district,province,postal_code,ncm_destination_branch,payment_method,customer_note,coupon_code,coupon_discount_percent,coupon_free_shipping)
 values(v_customer_id,v_checkout_key,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),nullif(trim(p_customer->>'postal_code'),''),v_ncm_destination_branch,p_payment_method,p_customer_note,case when v_coupon_code is null then null else v_coupon.code end,coalesce(v_coupon.discount_percent,0),coalesce(v_coupon.free_shipping,false))
 returning id,order_number into v_order_id,v_order_number;
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_code:=upper(trim(v_item->>'code')); v_size:=nullif(trim(v_item->>'size'),''); v_color:=nullif(trim(v_item->>'color'),'');
   v_qty:=greatest(1,coalesce((v_item->>'qty')::integer,1));
   select * into v_product from public.products where upper(product_code)=v_code and is_active=true for update;
   if not found then raise exception 'Product % is unavailable',v_code; end if;
   v_name:=v_product.name; v_unit_price:=v_product.price; v_size_id:=null; v_stock:=null;
   if v_size is not null and v_color is not null then
     select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and upper(coalesce(size,''))=upper(v_size) and upper(coalesce(color,''))=upper(v_color) order by id limit 1 for update;
     if not found then select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and upper(coalesce(size,''))=upper(v_size) and color is null order by id limit 1 for update; end if;
   elsif v_size is not null then
     select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and upper(coalesce(size,''))=upper(v_size) and color is null order by id limit 1 for update;
   elsif v_color is not null then
     select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and size is null and upper(coalesce(color,''))=upper(v_color) order by id limit 1 for update;
     if not found and upper(coalesce(v_product.color,''))=upper(v_color) then select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and size is null and color is null order by id limit 1 for update; end if;
   else
     select id,stock into v_size_id,v_stock from public.product_sizes where product_id=v_product.id and is_active=true and size is null and color is null order by id limit 1 for update;
   end if;
   if not found then raise exception 'Selected variant is unavailable for %',v_code; end if;
   if coalesce(v_stock,0)<v_qty then raise exception 'Only % item(s) available for %',coalesce(v_stock,0),v_code; end if;
   update public.product_sizes set stock=stock-v_qty where id=v_size_id;
   v_total:=v_unit_price*v_qty; v_subtotal:=v_subtotal+v_total;
   insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price) values(v_order_id,v_product.id,v_product.product_code,v_name,v_size,v_color,v_qty,v_unit_price,v_total);
   insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id) values(v_product.id,v_size_id,-v_qty,'order',v_order_id);
 end loop;
 v_subtotal:=round(v_subtotal);
 if v_coupon_code is not null then
   v_discount:=round(v_subtotal*v_coupon.discount_percent/100);
   if v_coupon.max_discount_amount is not null then v_discount:=least(v_discount,round(v_coupon.max_discount_amount)); end if;
   update public.discount_coupons set used_orders=used_orders+1,updated_at=now() where id=v_coupon.id;
   insert into public.coupon_redemptions(coupon_id,order_id,customer_id,discount_amount,free_shipping) values(v_coupon.id,v_order_id,v_customer_id,v_discount,v_coupon.free_shipping);
 end if;
 if v_ncm_destination_branch is null then
   raise exception 'Please select an NCM delivery branch before placing the order';
 end if;
 select round(coalesce(r.ncm_charge,0)+coalesce(r.door_pickup_charge,15))
 into v_shipping_fee
 from public.ncm_delivery_rate_cache r
 where upper(trim(r.origin_branch))='GAUR'
   and upper(trim(r.destination_branch))=upper(trim(v_ncm_destination_branch))
   and r.delivery_type='Pickup/Collect'
   and r.expires_at>now()
 order by r.fetched_at desc
 limit 1;
 if not found then
   raise exception 'NCM delivery rate is unavailable for the selected branch. Please refresh the branch quote and try again';
 end if;
 v_final_total:=round(greatest(0,v_subtotal-v_discount))+v_shipping_fee;
 if p_payment_method='cod' then
   v_cod_advance:=least(v_final_total,v_shipping_fee);
 end if;
 update public.orders set subtotal=v_subtotal,discount=v_discount,discount_amount=v_discount,shipping_fee=v_shipping_fee,total=v_final_total,
   cod_advance_required=v_cod_advance,cod_advance_paid=0,cod_balance_due=case when p_payment_method='cod' then greatest(0,v_final_total-v_cod_advance) else 0 end,
   cod_advance_payment_status=case when p_payment_method='cod' then case when v_cod_advance>0 then 'pending' else 'paid' end else 'not_required' end
 where id=v_order_id;
 return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'shipping_fee',v_shipping_fee,'total',v_final_total,'coupon_code',v_coupon_code,'free_shipping',coalesce(v_coupon.free_shipping,false),'cod_advance_required',v_cod_advance,'cod_balance_due',case when p_payment_method='cod' then greatest(0,v_final_total-v_cod_advance) else 0 end);
end;
$function$;

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
    total_amount,shipping_fee,advance_amount,balance_amount,advance_percent,balance_method,
    payment_method,payment_provider,payment_purpose,customer_snapshot,customer_note
  )
  values(
    p_user_id,v_customer_id,v_product.id,v_product.product_code,
    case when v_variant_found then v_variant.size else nullif(trim(p_size),'') end,
    case when v_variant_found then v_variant.color else nullif(trim(p_color),'') end,
    p_qty,v_total,v_shipping_fee,v_advance,v_balance,
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

  v_regular:=round((select price from public.products where id=v_intent.product_id)*v_intent.quantity);
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
    v_intent.quantity,p.price,(v_intent.total_amount-coalesce(v_intent.shipping_fee,0)),true,v_discount,v_intent.advance_amount,
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

CREATE OR REPLACE FUNCTION public.place_preorder_order(p_customer jsonb, p_items jsonb, p_payment_method text DEFAULT 'fonepay'::text, p_customer_note text DEFAULT NULL::text, p_balance_method text DEFAULT 'online'::text)
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
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_sizes%rowtype;
  v_variant_found boolean;
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
  v_shipping_fee numeric(12,2):=0;
begin
  if p_balance_method not in ('online','cod') then
    raise exception 'Remaining balance method must be online or cod';
  end if;
  if p_payment_method <> 'fonepay' then
    raise exception 'Preorder advance payments must use Fonepay';
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
  if v_destination is null then raise exception 'Please select an NCM delivery branch'; end if;
  select round(coalesce(r.ncm_charge,0)+coalesce(r.door_pickup_charge,15)) into v_shipping_fee
  from public.ncm_delivery_rate_cache r
  where upper(trim(r.origin_branch))='GAUR'
    and upper(trim(r.destination_branch))=upper(trim(v_destination))
    and r.delivery_type='Pickup/Collect' and r.expires_at>now()
  order by r.fetched_at desc limit 1;
  if not found then raise exception 'NCM delivery rate is unavailable for the selected branch. Please refresh the branch quote and try again'; end if;
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
    v_variant_found := found;

    if not v_variant_found and not coalesce(v_product.preorder_enabled,false) then
      raise exception 'Selected variant is unavailable for %',v_code;
    end if;
    if v_variant_found and not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then
      raise exception 'Preorder is not enabled for %',v_code;
    end if;

    if v_variant_found then
      v_advance_percent := coalesce(v_variant.preorder_advance_percent,v_product.preorder_advance_percent,30);
    else
      v_advance_percent := coalesce(v_product.preorder_advance_percent,30);
    end if;
    if v_advance_percent < 1 or v_advance_percent > 100 then
      raise exception 'Invalid preorder advance configuration for %',v_code;
    end if;

    v_regular_line := round(v_product.price * v_qty);
    v_discount := round(v_regular_line * 0.05);
    v_final_line := round(v_regular_line-v_discount);
    v_advance := round(v_final_line*v_advance_percent/100);
    v_balance := round(v_final_line-v_advance);

    insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,
      unit_price,total_price,is_preorder,preorder_discount,advance_amount,balance_amount,preorder_status,preorder_balance_method)
    values(v_order_id,v_product.id,v_product.product_code,v_product.name,
      case when v_variant_found then v_variant.size else v_size end,
      case when v_variant_found then v_variant.color else v_color end,
      v_qty,v_product.price,v_final_line,true,v_discount,v_advance,v_balance,'awaiting_advance',p_balance_method);

    v_subtotal := v_subtotal+v_regular_line;
    v_discount_total := v_discount_total+v_discount;
    v_advance_total := v_advance_total+v_advance;
  end loop;

  update public.orders set subtotal=v_subtotal,discount=v_discount_total,
    discount_amount=v_discount_total,shipping_fee=v_shipping_fee,total=round(v_subtotal-v_discount_total)+v_shipping_fee, payment_status='pending'
  where id=v_order_id;

  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,
    'subtotal',v_subtotal,'discount',v_discount_total,'shipping_fee',v_shipping_fee,'total',round(v_subtotal-v_discount_total)+v_shipping_fee,
    'advance_due',v_advance_total,'balance_due',round(v_subtotal-v_discount_total-v_advance_total)+v_shipping_fee,
    'payment_status','pending');
end;
$function$;
