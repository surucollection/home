alter table public.orders add column if not exists delivery_note text;

create or replace function public.admin_mark_self_delivery(p_order_id uuid, p_note text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $function$
declare v_order public.orders;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_status in ('cancelled','returned') then
    raise exception 'Cancelled or returned orders cannot be marked delivered';
  end if;
  if v_order.ncm_order_id is not null
     and lower(coalesce(v_order.ncm_status,'')) not in ('cancelled','canceled') then
    raise exception 'This order has an active NCM shipment. Sync or cancel the shipment first.';
  end if;
  update public.orders
     set order_status='delivered',
         delivery_method='self_delivery',
         delivered_at=coalesce(delivered_at,now()),
         delivered_by=coalesce(delivered_by,auth.uid()),
         delivery_note=coalesce(nullif(trim(p_note),''),delivery_note)
   where id=p_order_id returning * into v_order;
  return v_order;
end;
$function$;

revoke all on function public.admin_mark_self_delivery(uuid,text) from public, anon;
grant execute on function public.admin_mark_self_delivery(uuid,text) to authenticated;
