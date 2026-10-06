-- Keep the selected NCM destination branch when a paid preorder is finalized into an order.
create or replace function public.finalize_preorder_payment_intent(
  p_intent_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_intent public.preorder_payment_intents%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_regular numeric(12,2);
  v_discount numeric(12,2);
begin
  select * into v_intent
  from public.preorder_payment_intents
  where id=p_intent_id and auth_user_id=p_user_id
  for update;

  if not found then raise exception 'Preorder payment intent not found'; end if;
  if v_intent.payment_status<>'paid' then raise exception 'Payment is not verified'; end if;

  if v_intent.order_id is not null then
    return jsonb_build_object('success',true,'already_finalized',true,'order_id',v_intent.order_id,'order_number',(select order_number from public.orders where id=v_intent.order_id));
  end if;

  v_regular:=round((select price from public.products where id=v_intent.product_id)*v_intent.quantity);
  v_discount:=round(v_regular*0.05);

  insert into public.orders(
    customer_id,customer_name,customer_phone,customer_email,
    shipping_address,city,district,province,postal_code,ncm_destination_branch,
    payment_method,customer_note,subtotal,discount,discount_amount,total,
    payment_status,order_status
  )
  select
    v_intent.customer_id,c.name,c.phone,c.email,
    c.address,c.city,c.district,c.province,c.postal_code,c.ncm_destination_branch,
    case when v_intent.payment_purpose='cod_advance' then 'cod' else 'fonepay' end,
    v_intent.customer_note,v_regular,v_discount,v_discount,v_intent.total_amount,
    case when v_intent.payment_purpose='cod_advance' then 'pending' else 'paid' end,'confirmed'
  from public.customers c
  where c.id=v_intent.customer_id
  returning id,order_number into v_order_id,v_order_number;

  insert into public.order_items(
    order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price,
    is_preorder,preorder_discount,advance_amount,balance_amount,preorder_status,
    preorder_balance_method,advance_payment_status,advance_payment_reference,
    advance_payment_verified_at,advance_payment_note
  )
  select
    v_order_id,v_intent.product_id,v_intent.product_code,p.name,v_intent.size,v_intent.color,
    v_intent.quantity,p.price,v_intent.total_amount,true,v_discount,v_intent.advance_amount,
    v_intent.balance_amount,'confirmed',v_intent.balance_method,'verified',
    v_intent.payment_reference,v_intent.paid_at,'Verified by Fonepay'
  from public.products p
  where p.id=v_intent.product_id;

  update public.orders set
    cod_advance_required=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,
    cod_advance_paid=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,
    cod_balance_due=case when v_intent.payment_purpose='cod_advance' then v_intent.balance_amount else 0 end,
    cod_advance_payment_status=case when v_intent.payment_purpose='cod_advance' then 'paid' else 'not_required' end
  where id=v_order_id;

  update public.preorder_payment_intents set order_id=v_order_id,finalized_at=now(),updated_at=now()
  where id=v_intent.id;

  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'advance_paid',v_intent.advance_amount,'balance_due',v_intent.balance_amount,'payment_purpose',v_intent.payment_purpose);
end;
$function$;
