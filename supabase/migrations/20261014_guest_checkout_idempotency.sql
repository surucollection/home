-- Serialize checkout requests with the same idempotency key and resume existing guest orders.
-- This preserves the current order validation and order/payment response contract.
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
 v_coupon_code text:=nullif(trim(p_coupon_code),''); v_cod_advance numeric(12,2):=0; v_shipping_fee numeric(12,2):=0; v_branch_delivery_fee numeric(12,2):=0;
begin
 if p_payment_method not in ('cod','esewa','khalti','fonepay','online') then raise exception 'Invalid payment method'; end if;
 if v_checkout_key is not null and (length(v_checkout_key)>64 or v_checkout_key !~ '^[0-9a-fA-F-]{16,64}$') then raise exception 'Invalid checkout idempotency key'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
 if coalesce(trim(p_customer->>'name'),'')='' or coalesce(trim(p_customer->>'phone'),'')='' or coalesce(trim(p_customer->>'address'),'')='' or coalesce(trim(p_customer->>'city'),'')='' then raise exception 'Customer details are incomplete'; end if;
 v_ncm_destination_branch:=nullif(trim(p_customer->>'ncm_destination_branch'),'');
 if v_checkout_key is not null then
   perform pg_advisory_xact_lock(hashtextextended(v_checkout_key,0));
 end if;
 if v_auth_user_id is null and v_checkout_key is not null then
   select o.* into v_existing
     from public.orders o
     join public.customers c on c.id=o.customer_id
    where o.checkout_idempotency_key=v_checkout_key
      and c.auth_user_id is null
    limit 1;
   if found then
     return jsonb_build_object('success',true,'duplicate',true,'order_id',v_existing.id,'order_number',v_existing.order_number,'subtotal',v_existing.subtotal,'discount',coalesce(v_existing.discount,0),'shipping_fee',coalesce(v_existing.shipping_fee,0),'total',v_existing.total,'coupon_code',v_existing.coupon_code,'free_shipping',coalesce(v_existing.coupon_free_shipping,false),'cod_advance_required',coalesce(v_existing.cod_advance_required,0),'cod_balance_due',coalesce(v_existing.cod_balance_due,0));
   end if;
 end if;
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
 into v_branch_delivery_fee
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
 v_shipping_fee:=v_branch_delivery_fee;
 if coalesce(v_coupon.free_shipping,false) then
   v_shipping_fee:=0;
 end if;
 v_final_total:=round(greatest(0,v_subtotal-v_discount))+v_shipping_fee;
 if p_payment_method='cod' then
   -- Preserve the existing COD advance policy: it is a prepayment toward the order total.
   -- A free-shipping coupon waives the shipping line, not this existing COD advance requirement.
   v_cod_advance:=least(v_final_total,v_branch_delivery_fee);
 end if;
 update public.orders set subtotal=v_subtotal,discount=v_discount,discount_amount=v_discount,shipping_fee=v_shipping_fee,total=v_final_total,
   cod_advance_required=v_cod_advance,cod_advance_paid=0,cod_balance_due=case when p_payment_method='cod' then greatest(0,v_final_total-v_cod_advance) else 0 end,
   cod_advance_payment_status=case when p_payment_method='cod' then case when v_cod_advance>0 then 'pending' else 'paid' end else 'not_required' end
 where id=v_order_id;
 return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'shipping_fee',v_shipping_fee,'total',v_final_total,'coupon_code',v_coupon_code,'free_shipping',coalesce(v_coupon.free_shipping,false),'cod_advance_required',v_cod_advance,'cod_balance_due',case when p_payment_method='cod' then greatest(0,v_final_total-v_cod_advance) else 0 end);
end;
$function$;
