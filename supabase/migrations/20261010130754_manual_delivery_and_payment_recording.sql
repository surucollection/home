-- Manual fulfilment and payment recording for orders delivered outside Nepal Can Move.
-- Additive fields; existing checkout/Fonepay records remain unchanged.
alter table public.orders
  add column if not exists delivery_method text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_by uuid references auth.users(id) on delete set null,
  add column if not exists manual_payment_method text,
  add column if not exists manual_payment_reference text,
  add column if not exists manual_payment_note text,
  add column if not exists manually_paid_at timestamptz,
  add column if not exists manually_paid_by uuid references auth.users(id) on delete set null;

alter table public.orders
  drop constraint if exists orders_delivery_method_check;
alter table public.orders
  add constraint orders_delivery_method_check
  check (delivery_method is null or delivery_method in ('ncm','self_delivery','other'));

alter table public.orders
  drop constraint if exists orders_manual_payment_method_check;
alter table public.orders
  add constraint orders_manual_payment_method_check
  check (manual_payment_method is null or manual_payment_method in ('cash','bank_transfer_static_qr'));

create or replace function public.enforce_cod_advance_order_status()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.payment_method = 'cod'
     and coalesce(new.cod_advance_required, 0) > 0
     and coalesce(new.cod_advance_paid, 0) < coalesce(new.cod_advance_required, 0)
     and coalesce(new.payment_status, 'pending') <> 'paid'
     and coalesce(new.delivery_method, 'ncm') <> 'self_delivery' then
    if new.order_status in ('confirmed','processing','packed','shipped','delivered') then
      raise exception 'COD order requires the advance to be paid before fulfillment status can be set';
    end if;
    if new.ncm_order_id is not null
       and (tg_op = 'INSERT' or old.ncm_order_id is null) then
      raise exception 'COD order requires the advance to be paid before a shipment can be created';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.apply_cod_advance_setting()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  -- Normal COD advance is calculated by place_order from the applicable
  -- NCM delivery rate. Do not read the legacy fixed invoice_settings amount.
  if new.payment_method='cod' and not exists (
    select 1 from public.order_items oi where oi.order_id=new.id and oi.is_preorder=true
  ) then
    new.cod_advance_required:=coalesce(new.cod_advance_required,0);
    if coalesce(new.payment_status,'pending')='paid' then
      new.cod_balance_due:=0;
    else
      new.cod_balance_due:=greatest(0,coalesce(new.total,0)-coalesce(new.cod_advance_required,0));
    end if;
    if coalesce(new.cod_advance_payment_status,'')='' then
      new.cod_advance_payment_status:=case when coalesce(new.cod_advance_required,0)>0 then 'pending' else 'not_required' end;
    end if;
  elsif new.payment_method<>'cod' then
    new.cod_advance_required:=0;
    new.cod_balance_due:=0;
    new.cod_advance_paid:=0;
    new.cod_advance_payment_status:='not_required';
  end if;
  return new;
end;
$function$;

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
         manual_payment_note=coalesce(nullif(trim(p_note),''),manual_payment_note)
   where id=p_order_id returning * into v_order;
  return v_order;
end;
$function$;

create or replace function public.admin_record_manual_order_payment(
  p_order_id uuid,
  p_method text,
  p_reference text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $function$
declare v_order public.orders;
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
  update public.orders
     set payment_status='paid',
         manual_payment_method=p_method,
         manual_payment_reference=nullif(trim(coalesce(p_reference,'')),''),
         manual_payment_note=coalesce(nullif(trim(coalesce(p_note,'')),''),manual_payment_note),
         manually_paid_at=now(),
         manually_paid_by=auth.uid(),
         cod_balance_due=0
   where id=p_order_id returning * into v_order;
  return v_order;
end;
$function$;

revoke all on function public.admin_mark_self_delivery(uuid,text) from public, anon;
revoke all on function public.admin_record_manual_order_payment(uuid,text,text,text) from public, anon;
grant execute on function public.admin_mark_self_delivery(uuid,text) to authenticated;
grant execute on function public.admin_record_manual_order_payment(uuid,text,text,text) to authenticated;
