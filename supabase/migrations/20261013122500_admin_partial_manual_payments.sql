-- Support partial manual payments without marking an order fully paid until its outstanding amount is covered.
create or replace function public.admin_record_manual_order_payment(
  p_order_id uuid,
  p_method text,
  p_reference text default null,
  p_note text default null,
  p_amount numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order public.orders;
  v_due numeric(12,2);
  v_amount numeric(12,2);
  v_total_received numeric(12,2);
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_method not in ('cash','bank_transfer_static_qr') then
    raise exception 'Choose cash or bank transfer / static QR';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_status in ('cancelled','returned') then
    raise exception 'Cancelled or returned orders cannot be marked paid';
  end if;
  if v_order.payment_status='paid' then
    raise exception 'This order is already marked paid';
  end if;

  v_due := greatest(0, round(coalesce(v_order.total,0)
    - case when v_order.payment_method='cod' then coalesce(v_order.cod_advance_paid,0) else 0 end
    - coalesce(v_order.manual_payment_amount,0), 2));
  v_amount := coalesce(p_amount, v_due);
  if v_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if v_amount > v_due then raise exception 'Payment amount cannot exceed the outstanding balance of NPR %', v_due; end if;

  v_total_received := round(coalesce(v_order.manual_payment_amount,0) + v_amount,2);
  update public.orders
     set payment_status=case when v_amount >= v_due then 'paid' else coalesce(nullif(payment_status,''),'pending') end,
         manual_payment_method=p_method,
         manual_payment_amount=v_total_received,
         manual_payment_reference=nullif(trim(coalesce(p_reference,'')),''),
         manual_payment_note=coalesce(nullif(trim(coalesce(p_note,'')),''),manual_payment_note),
         manually_paid_at=now(),
         manually_paid_by=auth.uid(),
         cod_balance_due=case when payment_method='cod' then greatest(0,round(coalesce(total,0)-coalesce(cod_advance_paid,0)-v_total_received,2)) else cod_balance_due end
   where id=p_order_id returning * into v_order;
  return v_order;
end;
$function$;

revoke all on function public.admin_record_manual_order_payment(uuid,text,text,text) from public, anon;
revoke all on function public.admin_record_manual_order_payment(uuid,text,text,text,numeric) from public, anon;
grant execute on function public.admin_record_manual_order_payment(uuid,text,text,text,numeric) to authenticated;
