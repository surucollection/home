ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS inventory_released_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_payment_expiry_idx
  ON public.orders (payment_expires_at)
  WHERE payment_expires_at IS NOT NULL
    AND order_status = 'pending';

CREATE OR REPLACE FUNCTION public.set_payment_hold_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if new.payment_expires_at is null
     and new.order_status='pending'
     and new.payment_status <> 'paid'
     and (
       new.payment_method='fonepay'
       or (new.payment_method='cod' and coalesce(new.cod_advance_required,0)>0
           and coalesce(new.cod_advance_payment_status,'pending')<>'paid')
     )
  then
    new.payment_expires_at := now() + interval '15 minutes';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS orders_payment_hold_expiry_trigger ON public.orders;
CREATE TRIGGER orders_payment_hold_expiry_trigger
BEFORE INSERT OR UPDATE OF payment_method,payment_status,order_status,cod_advance_required,cod_advance_payment_status,payment_expires_at
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_hold_expiry();

REVOKE EXECUTE ON FUNCTION public.set_payment_hold_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_payment_hold_expiry() TO postgres;

CREATE OR REPLACE FUNCTION public.expire_fonepay_payment_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_size_id uuid;
  v_restored integer := 0;
  v_now timestamptz := now();
  v_reason text := 'Fonepay payment expired after 15 minutes';
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then
    return jsonb_build_object('success',false,'state','not_found','order_id',p_order_id);
  end if;

  if v_order.payment_expired_at is not null then
    return jsonb_build_object('success',true,'state','already_expired','order_id',v_order.id,'order_number',v_order.order_number,'payment_expired_at',v_order.payment_expired_at);
  end if;

  if v_order.order_status <> 'pending' then
    return jsonb_build_object('success',true,'state','not_pending','order_id',v_order.id,'order_status',v_order.order_status);
  end if;

  if v_order.payment_expires_at is null or v_order.payment_expires_at > v_now then
    return jsonb_build_object('success',true,'state','active','order_id',v_order.id,'payment_expires_at',v_order.payment_expires_at);
  end if;

  if v_order.payment_method='fonepay' then
    if v_order.payment_status='paid' then
      return jsonb_build_object('success',true,'state','paid','order_id',v_order.id);
    end if;
  elsif v_order.payment_method='cod' then
    if coalesce(v_order.cod_advance_required,0)<=0
       or v_order.cod_advance_payment_status='paid'
       or coalesce(v_order.cod_advance_paid,0)>=coalesce(v_order.cod_advance_required,0)
    then
      return jsonb_build_object('success',true,'state','paid','order_id',v_order.id);
    end if;
  else
    return jsonb_build_object('success',true,'state','not_applicable','order_id',v_order.id);
  end if;

  if v_order.inventory_released_at is null then
    for v_item in
      select oi.product_id,oi.size,oi.color,oi.quantity
      from public.order_items oi
      where oi.order_id=v_order.id
        and coalesce(oi.is_preorder,false)=false
    loop
      v_size_id:=null;

      select ps.id into v_size_id
      from public.product_sizes ps
      where ps.product_id=v_item.product_id
        and upper(coalesce(ps.size,''))=upper(coalesce(v_item.size,''))
        and (
          upper(coalesce(ps.color,''))=upper(coalesce(v_item.color,''))
          or ps.color is null
        )
      order by
        case
          when upper(coalesce(ps.color,''))=upper(coalesce(v_item.color,'')) then 0
          when ps.color is null then 1
          else 2
        end,
        ps.id
      limit 1
      for update;

      if v_size_id is not null then
        update public.product_sizes set stock=stock+greatest(0,v_item.quantity) where id=v_size_id;
        insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id)
        values(v_item.product_id,v_size_id,greatest(0,v_item.quantity),'payment_expired',v_order.id);
        v_restored:=v_restored+1;
      else
        raise warning 'Could not restore inventory for expired order % item % (size %, color %)',
          v_order.order_number,v_item.product_id,coalesce(v_item.size,''),coalesce(v_item.color,'');
      end if;
    end loop;
  end if;

  update public.orders
     set order_status='cancelled',
         cancellation_status='accepted',
         cancellation_reason=coalesce(nullif(trim(v_order.cancellation_reason),''),v_reason),
         cancellation_requested_at=coalesce(v_order.cancellation_requested_at,v_now),
         cancellation_reviewed_at=v_now,
         cancellation_admin_note='Payment session expired automatically after 15 minutes; reserved inventory was released.',
         payment_expired_at=v_now,
         inventory_released_at=coalesce(v_order.inventory_released_at,v_now),
         payment_status=case when payment_method='fonepay' and payment_status<>'paid' then 'failed' else payment_status end,
         fonepay_status=case when payment_method='fonepay' and payment_status<>'paid' then 'expired' else fonepay_status end,
         cod_advance_payment_status=case
           when payment_method='cod' and cod_advance_required>0 and cod_advance_payment_status<>'paid' then 'expired'
           else cod_advance_payment_status
         end,
         updated_at=v_now
   where id=v_order.id;

  return jsonb_build_object(
    'success',true,'state','expired','order_id',v_order.id,'order_number',v_order.order_number,
    'inventory_restored',v_restored>0,'restored_item_count',v_restored,'payment_expired_at',v_now
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_fonepay_payment_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_fonepay_payment_order(uuid) TO postgres;

CREATE OR REPLACE FUNCTION public.expire_fonepay_payment_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order_id uuid;
  v_count integer:=0;
begin
  for v_order_id in
    select o.id
    from public.orders o
    where o.order_status='pending'
      and o.payment_expires_at is not null
      and o.payment_expires_at<=now()
      and (
        (o.payment_method='fonepay' and o.payment_status<>'paid')
        or
        (o.payment_method='cod'
         and coalesce(o.cod_advance_required,0)>0
         and o.cod_advance_payment_status<>'paid'
         and coalesce(o.cod_advance_paid,0)<o.cod_advance_required)
      )
    order by o.payment_expires_at
    for update skip locked
  loop
    if (public.expire_fonepay_payment_order(v_order_id)->>'state')='expired' then
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_fonepay_payment_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_fonepay_payment_orders() TO postgres;

UPDATE public.orders
   SET payment_expires_at=coalesce(
     case when payment_method='fonepay' then fonepay_initiated_at+interval '15 minutes' end,
     case when payment_method='cod' and cod_advance_required>0 then cod_advance_fonepay_initiated_at+interval '15 minutes' end,
     created_at+interval '15 minutes'
   )
 WHERE payment_expires_at is null
   AND order_status='pending'
   AND (
     (payment_method='fonepay' and payment_status<>'paid')
     or
     (payment_method='cod'
      and coalesce(cod_advance_required,0)>0
      and cod_advance_payment_status<>'paid'
      and coalesce(cod_advance_paid,0)<cod_advance_required)
   );

DO $schedule$
begin
  if not exists (select 1 from cron.job where jobname='suru-fonepay-payment-expiry') then
    perform cron.schedule(
      'suru-fonepay-payment-expiry',
      '* * * * *',
      $job$select public.expire_fonepay_payment_orders();$job$
    );
  end if;
end;
$schedule$;

CREATE OR REPLACE FUNCTION public.claim_fonepay_payment_setup(
  p_order_id uuid,
  p_purpose text DEFAULT 'full'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_reference text;
  v_status text;
  v_now timestamptz:=now();
begin
  if p_purpose not in ('full','cod_advance') then raise exception 'Unsupported payment purpose'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.payment_expired_at is not null then
    return jsonb_build_object('state','expired','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at,'payment_expired_at',v_order.payment_expired_at);
  end if;

  if v_order.order_status='pending' and v_order.payment_expires_at is not null and v_order.payment_expires_at<=v_now then
    perform public.expire_fonepay_payment_order(v_order.id);
    return jsonb_build_object('state','expired','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at,'payment_expired_at',v_now);
  end if;

  if p_purpose='cod_advance' then
    if v_order.payment_method<>'cod' then raise exception 'This order is not configured for COD'; end if;
    if coalesce(v_order.cod_advance_required,0)<=0 then raise exception 'This COD order does not require an online advance'; end if;
    if v_order.cod_advance_payment_status='paid' or coalesce(v_order.cod_advance_paid,0)>=v_order.cod_advance_required then
      return jsonb_build_object('state','already_paid','amount',v_order.cod_advance_required,'balance_due',coalesce(v_order.cod_balance_due,0),'order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
    end if;
    v_status:=coalesce(v_order.cod_advance_payment_status,'pending');

    if v_status='initiated' and v_order.cod_advance_fonepay_reference is not null and v_order.cod_advance_fonepay_response ? 'qrString' then
      return jsonb_build_object('state','resume','reference',v_order.cod_advance_fonepay_reference,'amount',v_order.cod_advance_required,'balance_due',coalesce(v_order.cod_balance_due,0),'response',v_order.cod_advance_fonepay_response,'order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
    end if;

    if v_status='creating' and v_order.cod_advance_fonepay_initiated_at > v_now-interval '60 seconds' then
      return jsonb_build_object('state','in_progress','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
    end if;

    v_reference:=case when v_status='creating' and v_order.cod_advance_fonepay_reference is not null then v_order.cod_advance_fonepay_reference else 'SC'||substr(replace(gen_random_uuid()::text,'-',''),1,26) end;

    update public.orders
       set cod_advance_fonepay_reference=v_reference,
           cod_advance_payment_status='creating',
           cod_advance_fonepay_initiated_at=v_now,
           payment_expires_at=coalesce(v_order.payment_expires_at,v_now+interval '15 minutes'),
           updated_at=v_now
     where id=v_order.id;

    return jsonb_build_object('state','claimed','reference',v_reference,'amount',v_order.cod_advance_required,'balance_due',coalesce(v_order.cod_balance_due,0),'order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',coalesce(v_order.payment_expires_at,v_now+interval '15 minutes'));
  end if;

  if v_order.payment_method<>'fonepay' then raise exception 'This order is not configured for Fonepay'; end if;
  if v_order.payment_status='paid' then
    return jsonb_build_object('state','already_paid','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
  end if;
  v_status:=coalesce(v_order.fonepay_status,'pending');

  if v_status='initiated' and v_order.fonepay_reference is not null and v_order.fonepay_response ? 'qrString' then
    return jsonb_build_object('state','resume','reference',v_order.fonepay_reference,'amount',v_order.total,'response',v_order.fonepay_response,'order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
  end if;

  if v_status='creating' and v_order.fonepay_initiated_at > v_now-interval '60 seconds' then
    return jsonb_build_object('state','in_progress','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
  end if;

  v_reference:=case when v_status='creating' and v_order.fonepay_reference is not null then v_order.fonepay_reference else 'SC'||substr(replace(gen_random_uuid()::text,'-',''),1,26) end;

  update public.orders
     set fonepay_reference=v_reference,
         fonepay_status='creating',
         fonepay_initiated_at=v_now,
         payment_expires_at=coalesce(v_order.payment_expires_at,v_now+interval '15 minutes'),
         updated_at=v_now
   where id=v_order.id;

  return jsonb_build_object('state','claimed','reference',v_reference,'amount',v_order.total,'order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',coalesce(v_order.payment_expires_at,v_now+interval '15 minutes'));
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_fonepay_payment_setup(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_fonepay_payment_setup(uuid,text) TO authenticated;

SELECT public.expire_fonepay_payment_orders();
