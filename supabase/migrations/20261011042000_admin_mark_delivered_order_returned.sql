ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_mark_order_returned(
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Return reason is required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF lower(coalesce(v_order.order_status, '')) <> 'delivered' THEN
    RAISE EXCEPTION 'Only delivered orders can be marked as returned';
  END IF;

  UPDATE public.orders
  SET order_status = 'returned',
      return_reason = v_reason,
      returned_at = now(),
      returned_by = auth.uid(),
      updated_at = now()
  WHERE id = v_order.id;

  -- Return status only. Payment/refund, invoice status and inventory remain unchanged.
  RETURN jsonb_build_object(
    'success', true,
    'status', 'returned',
    'order_number', v_order.order_number,
    'payment_status_preserved', v_order.payment_status,
    'invoice_status_preserved', v_order.invoice_status,
    'inventory_restored', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_mark_order_returned(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_returned(uuid, text) TO authenticated;
