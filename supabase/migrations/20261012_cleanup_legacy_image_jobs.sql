-- Idempotent cleanup of abandoned image-processing jobs and repair the
-- one legacy product image set that lacked a main-image flag.

DELETE FROM public.product_image_processing_jobs
WHERE status = 'pending';

UPDATE public.product_images
SET is_main = (sort_order = 0)
WHERE product_id = (
  SELECT id FROM public.products WHERE product_code = 'SC021'
);
