alter function public.my_customer_profile()
  security invoker
  set search_path = '';

drop function if exists public.place_order(jsonb,jsonb,text,text,text);
