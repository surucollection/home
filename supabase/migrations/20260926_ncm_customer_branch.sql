-- Persist the customer's recommended/manual Nepal Can Move destination branch.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS ncm_destination_branch text;

-- Snapshot the branch into each new order so admins can create shipments without re-entering it.
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
DECLARE
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
  v_ncm_destination_branch text;
BEGIN
  IF p_payment_method NOT IN ('cod','esewa','khalti','fonepay','online') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF coalesce(trim(p_customer->>'name'),'')='' OR coalesce(trim(p_customer->>'phone'),'')='' OR coalesce(trim(p_customer->>'address'),'')='' OR coalesce(trim(p_customer->>'city'),'')='' THEN RAISE EXCEPTION 'Customer details are incomplete'; END IF;

  v_ncm_destination_branch := nullif(trim(p_customer->>'ncm_destination_branch'),'');
  IF v_auth_user_id IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.customers WHERE auth_user_id=v_auth_user_id LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code,ncm_destination_branch)
    VALUES(v_auth_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),nullif(trim(p_customer->>'postal_code'),''),v_ncm_destination_branch)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET
      name=trim(p_customer->>'name'),phone=trim(p_customer->>'phone'),email=nullif(trim(p_customer->>'email'),''),
      address=trim(p_customer->>'address'),city=trim(p_customer->>'city'),district=nullif(trim(p_customer->>'district'),''),
      province=nullif(trim(p_customer->>'province'),''),postal_code=nullif(trim(p_customer->>'postal_code'),''),
      ncm_destination_branch=coalesce(v_ncm_destination_branch,ncm_destination_branch),updated_at=now()
    WHERE id=v_customer_id;
    SELECT ncm_destination_branch INTO v_ncm_destination_branch FROM public.customers WHERE id=v_customer_id;
  END IF;

  INSERT INTO public.orders(customer_id,customer_name,customer_phone,customer_email,shipping_address,city,district,province,postal_code,ncm_destination_branch,payment_method,customer_note)
  VALUES(v_customer_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),nullif(trim(p_customer->>'district'),''),nullif(trim(p_customer->>'province'),''),nullif(trim(p_customer->>'postal_code'),''),v_ncm_destination_branch,p_payment_method,p_customer_note)
  RETURNING id,order_number INTO v_order_id,v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_code:=upper(trim(v_item->>'code')); v_size:=nullif(trim(v_item->>'size'),''); v_color:=nullif(trim(v_item->>'color'),''); v_qty:=greatest(1,coalesce((v_item->>'qty')::integer,1));
    SELECT * INTO v_product FROM public.products WHERE upper(product_code)=v_code AND is_active=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product % is unavailable',v_code; END IF;
    v_name:=v_product.name; v_unit_price:=v_product.price; v_size_id:=null; v_stock:=null;

    IF v_size IS NOT NULL AND v_color IS NOT NULL THEN
      SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND upper(coalesce(size,''))=upper(v_size) AND upper(coalesce(color,''))=upper(v_color) ORDER BY id LIMIT 1 FOR UPDATE;
      IF NOT FOUND THEN SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND upper(coalesce(size,''))=upper(v_size) AND color IS NULL ORDER BY id LIMIT 1 FOR UPDATE; END IF;
    ELSIF v_size IS NOT NULL THEN
      SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND upper(coalesce(size,''))=upper(v_size) AND color IS NULL ORDER BY id LIMIT 1 FOR UPDATE;
    ELSIF v_color IS NOT NULL THEN
      SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND size IS NULL AND upper(coalesce(color,''))=upper(v_color) ORDER BY id LIMIT 1 FOR UPDATE;
      IF NOT FOUND AND upper(coalesce(v_product.color,''))=upper(v_color) THEN SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND size IS NULL AND color IS NULL ORDER BY id LIMIT 1 FOR UPDATE; END IF;
    ELSE
      SELECT id,stock INTO v_size_id,v_stock FROM public.product_sizes WHERE product_id=v_product.id AND is_active=true AND size IS NULL AND color IS NULL ORDER BY id LIMIT 1 FOR UPDATE;
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Selected variant is unavailable for %',v_code; END IF;
    IF coalesce(v_stock,0)<v_qty THEN RAISE EXCEPTION 'Only % item(s) available for %',coalesce(v_stock,0),v_code; END IF;
    UPDATE public.product_sizes SET stock=stock-v_qty WHERE id=v_size_id;
    v_total:=v_unit_price*v_qty; v_subtotal:=v_subtotal+v_total;
    INSERT INTO public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price) VALUES(v_order_id,v_product.id,v_product.product_code,v_name,v_size,v_color,v_qty,v_unit_price,v_total);
    INSERT INTO public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id) VALUES(v_product.id,v_size_id,-v_qty,'order',v_order_id);
  END LOOP;

  UPDATE public.orders SET subtotal=v_subtotal,total=v_subtotal WHERE id=v_order_id;
  RETURN jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'total',v_subtotal);
END;
$function$;