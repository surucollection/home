-- Safely cancel orders from the admin panel without undoing delivery/payment history.
-- Delivered orders are not restocked automatically. Payments are never refunded automatically.
CREATE OR REPLACE FUNCTION public.admin_cancel_order(
  p_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_item record;
  v_restored boolean := false;
  v_is_delivered boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF lower(coalesce(v_order.order_status, '')) = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'status', 'cancelled',
      'inventory_restored', false, 'already_cancelled', true);
  END IF;
  IF lower(coalesce(v_order.order_status, '')) = 'returned' THEN
    RAISE EXCEPTION 'This order is already returned. Use the return/refund workflow instead of cancelling it';
  END IF;

  v_is_delivered :=
    lower(coalesce(v_order.order_status, '')) = 'delivered'
    OR (lower(coalesce(v_order.delivery_method, '')) = 'self_delivery' AND v_order.delivered_at IS NOT NULL)
    OR lower(coalesce(v_order.ncm_status, '')) ~
      '(delivered to|successfully delivered|delivery complete|delivery completed|^delivered$)';

  -- If an NCM shipment is already cancelled, allow the admin to finish cancelling the order.
  IF NOT v_is_delivered
     AND lower(coalesce(v_order.order_status, '')) = 'shipped'
     AND (v_order.ncm_order_id IS NULL OR lower(coalesce(v_order.ncm_status, '')) !~ '(cancelled|canceled)') THEN
    RAISE EXCEPTION 'This order has shipped. Cancel or resolve its shipment first, then retry';
  END IF;
  IF NOT v_is_delivered
     AND v_order.ncm_order_id IS NOT NULL
     AND lower(coalesce(v_order.ncm_status, '')) !~
       '(cancelled|canceled|delivered to|successfully delivered|delivery complete|delivery completed|^delivered$|returned to warehouse|returned$)' THEN
    RAISE EXCEPTION 'An NCM shipment is still active. Cancel or resolve the shipment first, then retry';
  END IF;

  -- Do not put delivered goods back into stock. For undelivered orders,
  -- restore inventory only after confirming the shipment is inactive.
  IF NOT v_is_delivered THEN
    FOR v_item IN
      SELECT oi.product_id, oi.quantity, ps.id AS size_id
      FROM public.order_items oi
      LEFT JOIN LATERAL (
        SELECT id
        FROM public.product_sizes
        WHERE product_id = oi.product_id
          AND is_active = true
          AND upper(coalesce(size, '')) = upper(coalesce(oi.size, ''))
          AND (upper(coalesce(color, '')) = upper(coalesce(oi.color, '')) OR color IS NULL)
        ORDER BY
          (CASE WHEN upper(coalesce(color, '')) = upper(coalesce(oi.color, '')) THEN 0 ELSE 1 END),
          id
        LIMIT 1
      ) ps ON true
      WHERE oi.order_id = v_order.id
    LOOP
      IF v_item.size_id IS NOT NULL THEN
        UPDATE public.product_sizes SET stock = stock + v_item.quantity WHERE id = v_item.size_id;
        INSERT INTO public.inventory_movements(product_id, size_id, quantity_change, reason, reference_id)
        VALUES (v_item.product_id, v_item.size_id, v_item.quantity, 'order_cancelled', v_order.id);
        v_restored := true;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET order_status = 'cancelled',
      cancellation_status = 'accepted',
      cancellation_reason = v_reason,
      cancellation_reviewed_at = now(),
      cancellation_admin_note = v_reason,
      updated_at = now()
  WHERE id = v_order.id;

  -- Preserve payment fields and invoice history. Cancelling is not a refund.
  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'inventory_restored', v_restored,
    'delivered_order', v_is_delivered,
    'payment_status_preserved', v_order.payment_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) TO authenticated;
