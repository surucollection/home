-- Customer cancellation flow:
-- Pending orders can be cancelled directly.
-- Confirmed orders can receive a customer cancellation request.
-- Processing and later cannot be cancelled/requested.
-- Admins can accept or reject confirmed-order cancellation requests.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_admin_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_cancellation_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_cancellation_status_check
      CHECK (cancellation_status IN ('none','requested','accepted','rejected'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_order_cancellation(
  p_order_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_item record;
  v_restored boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF NOT v_is_admin THEN
    SELECT id INTO v_customer_id FROM public.customers WHERE auth_user_id=v_uid LIMIT 1;
    IF v_customer_id IS NULL OR v_order.customer_id IS DISTINCT FROM v_customer_id THEN
      RAISE EXCEPTION 'You are not authorized to manage this order';
    END IF;

    IF p_action='cancel' THEN
      IF v_order.order_status <> 'pending' OR v_order.cancellation_status <> 'none' THEN
        RAISE EXCEPTION 'An order can only be cancelled while it is pending';
      END IF;

      FOR v_item IN
        SELECT oi.product_id,oi.quantity,ps.id AS size_id
        FROM public.order_items oi
        LEFT JOIN LATERAL (
          SELECT id FROM public.product_sizes
          WHERE product_id=oi.product_id AND is_active=true
            AND upper(coalesce(size,''))=upper(coalesce(oi.size,''))
            AND upper(coalesce(color,''))=upper(coalesce(oi.color,''))
          ORDER BY id LIMIT 1
        ) ps ON true
        WHERE oi.order_id=v_order.id
      LOOP
        IF v_item.size_id IS NOT NULL THEN
          UPDATE public.product_sizes SET stock=stock+v_item.quantity WHERE id=v_item.size_id;
          INSERT INTO public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id)
          VALUES(v_item.product_id,v_item.size_id,v_item.quantity,'order_cancelled',v_order.id);
          v_restored:=true;
        END IF;
      END LOOP;

      UPDATE public.orders SET order_status='cancelled',cancellation_status='accepted',
        cancellation_reason=nullif(trim(p_reason),''),cancellation_requested_at=now(),
        cancellation_reviewed_at=now(),cancellation_admin_note='Cancelled by customer while order was pending',updated_at=now()
      WHERE id=v_order.id;
      RETURN jsonb_build_object('success',true,'status','cancelled','inventory_restored',v_restored);

    ELSIF p_action='request_cancellation' THEN
      IF v_order.order_status <> 'confirmed' OR v_order.cancellation_status <> 'none' THEN
        RAISE EXCEPTION 'Cancellation requests are only available after confirmation and before processing';
      END IF;
      UPDATE public.orders SET cancellation_status='requested',
        cancellation_reason=nullif(trim(p_reason),''),cancellation_requested_at=now(),updated_at=now()
      WHERE id=v_order.id;
      RETURN jsonb_build_object('success',true,'status','requested');
    ELSE
      RAISE EXCEPTION 'Invalid customer cancellation action';
    END IF;
  END IF;

  IF p_action IN ('accept_cancellation','reject_cancellation') THEN
    IF v_order.cancellation_status <> 'requested' OR v_order.order_status <> 'confirmed' THEN
      RAISE EXCEPTION 'Cancellation requests can only be reviewed before processing';
    END IF;

    IF p_action='reject_cancellation' THEN
      UPDATE public.orders SET cancellation_status='rejected',cancellation_reviewed_at=now(),
        cancellation_admin_note=nullif(trim(p_admin_note),''),updated_at=now()
      WHERE id=v_order.id;
      RETURN jsonb_build_object('success',true,'status','rejected');
    END IF;

    FOR v_item IN
      SELECT oi.product_id,oi.quantity,ps.id AS size_id
      FROM public.order_items oi
      LEFT JOIN LATERAL (
        SELECT id FROM public.product_sizes
        WHERE product_id=oi.product_id AND is_active=true
          AND upper(coalesce(size,''))=upper(coalesce(oi.size,''))
          AND upper(coalesce(color,''))=upper(coalesce(oi.color,''))
        ORDER BY id LIMIT 1
      ) ps ON true
      WHERE oi.order_id=v_order.id
    LOOP
      IF v_item.size_id IS NOT NULL THEN
        UPDATE public.product_sizes SET stock=stock+v_item.quantity WHERE id=v_item.size_id;
        INSERT INTO public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id)
        VALUES(v_item.product_id,v_item.size_id,v_item.quantity,'order_cancelled',v_order.id);
        v_restored:=true;
      END IF;
    END LOOP;

    UPDATE public.orders SET order_status='cancelled',cancellation_status='accepted',
      cancellation_reviewed_at=now(),cancellation_admin_note=nullif(trim(p_admin_note),''),updated_at=now()
    WHERE id=v_order.id;
    RETURN jsonb_build_object('success',true,'status','cancelled','inventory_restored',v_restored);
  END IF;

  RAISE EXCEPTION 'Invalid administrator cancellation action';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_order_cancellation(uuid,text,text,text) TO authenticated;
