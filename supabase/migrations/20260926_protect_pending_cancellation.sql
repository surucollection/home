-- Prevent an admin from moving an order into processing/packed/shipped/etc. while
-- a customer cancellation request is still waiting for review.
CREATE OR REPLACE FUNCTION public.prevent_processing_with_pending_cancellation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.cancellation_status='requested'
     AND NEW.cancellation_status='requested'
     AND NEW.order_status NOT IN ('confirmed','cancelled') THEN
    RAISE EXCEPTION 'Review the pending cancellation request before moving this order forward';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_processing_with_pending_cancellation ON public.orders;
CREATE TRIGGER trg_prevent_processing_with_pending_cancellation
BEFORE UPDATE OF order_status,cancellation_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_processing_with_pending_cancellation();
