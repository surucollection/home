BEGIN;

DROP FUNCTION IF EXISTS public.create_exchange_inventory(uuid, uuid);

CREATE FUNCTION public.create_exchange_inventory(
  p_order_id uuid,
  p_exchange_product_id uuid,
  p_exchange_size_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_original_size public.product_sizes%rowtype;
  v_exchange_size public.product_sizes%rowtype;
  v_exchange_product public.products%rowtype;
  v_item_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF lower(coalesce(v_order.order_status, '')) <> 'delivered' THEN
    RAISE EXCEPTION 'Only delivered orders can be exchanged';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_exchanges WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'An exchange inventory record already exists for this order';
  END IF;

  SELECT count(*) INTO v_item_count
  FROM public.order_items
  WHERE order_id = p_order_id
    AND coalesce(is_preorder, false) = false;

  IF v_item_count <> 1 THEN
    RAISE EXCEPTION 'Inventory exchange currently requires exactly one stocked product in the order. Multi-item orders need the specific returned item selected.';
  END IF;

  SELECT * INTO v_item
  FROM public.order_items
  WHERE order_id = p_order_id
    AND coalesce(is_preorder, false) = false
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_item.product_id IS NULL THEN
    RAISE EXCEPTION 'No stocked original order item was found';
  END IF;

  SELECT * INTO v_original_size
  FROM public.product_sizes
  WHERE product_id = v_item.product_id
    AND upper(coalesce(size, '')) = upper(coalesce(v_item.size, ''))
    AND upper(coalesce(color, '')) = upper(coalesce(v_item.color, ''))
  ORDER BY is_active DESC, id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original size/colour inventory variant was not found';
  END IF;

  SELECT * INTO v_exchange_product
  FROM public.products
  WHERE id = p_exchange_product_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange product is unavailable';
  END IF;

  IF p_exchange_size_id IS NULL THEN
    RAISE EXCEPTION 'Select an exchange colour and size';
  END IF;

  SELECT * INTO v_exchange_size
  FROM public.product_sizes
  WHERE id = p_exchange_size_id
    AND product_id = p_exchange_product_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected exchange colour/size is no longer available';
  END IF;

  IF coalesce(v_exchange_size.stock, 0) < v_item.quantity THEN
    RAISE EXCEPTION 'Insufficient exchange stock for selected colour/size. Available: %, required: %',
      coalesce(v_exchange_size.stock, 0), v_item.quantity;
  END IF;

  UPDATE public.product_sizes
  SET stock = coalesce(stock, 0) - v_item.quantity
  WHERE id = v_exchange_size.id;

  INSERT INTO public.inventory_movements(product_id, size_id, quantity_change, reason, reference_id)
  VALUES (p_exchange_product_id, v_exchange_size.id, -v_item.quantity, 'exchange_dispatch', p_order_id);

  INSERT INTO public.order_exchanges(
    order_id,
    original_order_item_id,
    original_product_id,
    original_size_id,
    exchange_product_id,
    exchange_size_id,
    quantity
  )
  VALUES (
    p_order_id,
    v_item.id,
    v_item.product_id,
    v_original_size.id,
    p_exchange_product_id,
    v_exchange_size.id,
    v_item.quantity
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity', v_item.quantity,
    'exchange_product', v_exchange_product.name,
    'exchange_color', v_exchange_size.color,
    'exchange_size', v_exchange_size.size,
    'available_stock_after_dispatch', coalesce(v_exchange_size.stock, 0) - v_item.quantity,
    'return_received', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_exchange_inventory(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_exchange_inventory(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_exchange_inventory(uuid, uuid, uuid) TO authenticated;

COMMIT;
