-- Targeted production hardening applied on 2026-10-06.
-- This migration preserves application behavior and does not alter business data.

REVOKE ALL ON FUNCTION public.validate_discount_coupon(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_discount_coupon(text, numeric) TO authenticated;

ALTER FUNCTION public.touch_product_image_processing_job() SET search_path = public;
REVOKE ALL ON FUNCTION public.touch_product_image_processing_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_product_image_processing_job() TO postgres;

DROP POLICY IF EXISTS "admins can view image processing jobs" ON public.product_image_processing_jobs;
CREATE POLICY "admins can view image processing jobs"
  ON public.product_image_processing_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users a
      WHERE a.id = (SELECT auth.uid())
        AND a.is_active = true
        AND a.role IN ('admin','manager')
    )
  );

CREATE INDEX IF NOT EXISTS order_items_advance_payment_verified_by_idx
  ON public.order_items(advance_payment_verified_by);
CREATE INDEX IF NOT EXISTS preorder_stock_allocations_product_id_idx
  ON public.preorder_stock_allocations(product_id);
CREATE INDEX IF NOT EXISTS preorder_stock_allocations_size_id_idx
  ON public.preorder_stock_allocations(size_id);
