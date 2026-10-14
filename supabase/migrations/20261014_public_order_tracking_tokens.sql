ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_tracking_token text;

UPDATE public.orders
SET public_tracking_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_tracking_token IS NULL OR public_tracking_token = '';

ALTER TABLE public.orders
  ALTER COLUMN public_tracking_token SET DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN public_tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_tracking_token_uidx
  ON public.orders (public_tracking_token);