-- Allow public storefront visitors to validate coupons and create orders as guests.
-- Both routines are SECURITY DEFINER functions that validate product availability, stock,
-- pricing, coupon rules, delivery branches, and checkout inputs on the server.
GRANT EXECUTE ON FUNCTION public.place_order(jsonb,jsonb,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_discount_coupon(text,numeric) TO anon;
