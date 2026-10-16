create or replace function public.claim_fonepay_payment_setup(p_order_id uuid, p_purpose text default 'full'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders%rowtype;
  v_reference text;
  v_status text;
  v_now timestamptz := now();
  v_admin_order boolean;
begin
  if p_purpose not in ('full','cod_advance') then
    raise exception 'Unsupported payment purpose';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_admin_order := coalesce(lower(trim(v_order.order_source)), 'website') <> 'website';

  -- Admin-created COD orders are not website checkout sessions. Their QR
  -- requests may expire, but the order itself must remain payable and must
  -- be able to receive a replacement QR.
  if not (p_purpose = 'cod_advance' and v_admin_order) then
    if v_order.payment_expired_at is not null then
      return jsonb_build_object(
        'state','expired','order_id',v_order.id,'order_number',v_order.order_number,
        'payment_expires_at',v_order.payment_expires_at,'payment_expired_at',v_order.payment_expired_at
      );
    end if;

    if v_order.order_status = 'pending'
       and v_order.payment_expires_at is not null
       and v_order.payment_expires_at <= v_now then
      perform public.expire_fonepay_payment_order(v_order.id);
      return jsonb_build_object(
        'state','expired','order_id',v_order.id,'order_number',v_order.order_number,
        'payment_expires_at',v_order.payment_expires_at,'payment_expired_at',v_now
      );
    end if;
  end if;

  if p_purpose = 'cod_advance' then
    if v_order.payment_method <> 'cod' then
      raise exception 'This order is not configured for COD';
    end if;
    if coalesce(v_order.cod_advance_required,0) <= 0 then
      raise exception 'This COD order does not require an online advance';
    end if;
    if v_order.cod_advance_payment_status = 'paid'
       or coalesce(v_order.cod_advance_paid,0) >= v_order.cod_advance_required then
      return jsonb_build_object(
        'state','already_paid',
        'amount',greatest(0,v_order.cod_advance_required-coalesce(v_order.cod_advance_paid,0)),
        'balance_due',coalesce(v_order.cod_balance_due,0),
        'order_id',v_order.id,'order_number',v_order.order_number,
        'payment_expires_at',v_order.payment_expires_at
      );
    end if;

    v_status := coalesce(v_order.cod_advance_payment_status,'pending');

    -- Resume only a still-live QR. An expired admin-order QR gets a fresh
    -- reference and payment request instead of returning the stale QR.
    if v_status = 'initiated'
       and v_order.cod_advance_fonepay_reference is not null
       and v_order.cod_advance_fonepay_response ? 'qrString'
       and (not v_admin_order or (
         v_order.payment_expires_at is not null
         and v_order.payment_expires_at > v_now
         and v_order.payment_expired_at is null
       )) then
      return jsonb_build_object(
        'state','resume',
        'reference',v_order.cod_advance_fonepay_reference,
        'amount',greatest(0,v_order.cod_advance_required-coalesce(v_order.cod_advance_paid,0)),
        'balance_due',coalesce(v_order.cod_balance_due,0),
        'response',v_order.cod_advance_fonepay_response,
        'order_id',v_order.id,'order_number',v_order.order_number,
        'payment_expires_at',v_order.payment_expires_at
      );
    end if;

    if v_status = 'creating'
       and v_order.cod_advance_fonepay_initiated_at > v_now - interval '60 seconds' then
      return jsonb_build_object(
        'state','in_progress','order_id',v_order.id,'order_number',v_order.order_number,
        'payment_expires_at',v_order.payment_expires_at
      );
    end if;

    v_reference := case
      when v_status = 'creating'
       and v_order.cod_advance_fonepay_reference is not null
       and v_order.cod_advance_fonepay_initiated_at > v_now - interval '60 seconds'
      then v_order.cod_advance_fonepay_reference
      else 'SC' || substr(replace(gen_random_uuid()::text,'-',''),1,26)
    end;

    update public.orders
       set cod_advance_fonepay_reference = v_reference,
           cod_advance_payment_status = 'creating',
           cod_advance_fonepay_initiated_at = v_now,
           payment_expires_at = case when v_admin_order then v_now + interval '15 minutes'
                                     else coalesce(v_order.payment_expires_at,v_now + interval '15 minutes') end,
           payment_expired_at = case when v_admin_order then null else v_order.payment_expired_at end,
           updated_at = v_now
     where id = v_order.id;

    return jsonb_build_object(
      'state','claimed','reference',v_reference,
      'amount',greatest(0,v_order.cod_advance_required-coalesce(v_order.cod_advance_paid,0)),
      'balance_due',coalesce(v_order.cod_balance_due,0),
      'order_id',v_order.id,'order_number',v_order.order_number,
      'payment_expires_at',case when v_admin_order then v_now + interval '15 minutes'
                                else coalesce(v_order.payment_expires_at,v_now + interval '15 minutes') end
    );
  end if;

  if v_order.payment_method <> 'fonepay' then
    raise exception 'This order is not configured for Fonepay';
  end if;
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('state','already_paid','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
  end if;

  v_status := coalesce(v_order.fonepay_status,'pending');

  if v_status = 'initiated'
     and v_order.fonepay_reference is not null
     and v_order.fonepay_response ? 'qrString' then
    return jsonb_build_object(
      'state','resume','reference',v_order.fonepay_reference,'amount',v_order.total,
      'response',v_order.fonepay_response,'order_id',v_order.id,'order_number',v_order.order_number,
      'payment_expires_at',v_order.payment_expires_at
    );
  end if;

  if v_status = 'creating'
     and v_order.fonepay_initiated_at > v_now - interval '60 seconds' then
    return jsonb_build_object('state','in_progress','order_id',v_order.id,'order_number',v_order.order_number,'payment_expires_at',v_order.payment_expires_at);
  end if;

  v_reference := case
    when v_status = 'creating' and v_order.fonepay_reference is not null
    then v_order.fonepay_reference
    else 'SC' || substr(replace(gen_random_uuid()::text,'-',''),1,26)
  end;

  update public.orders
     set fonepay_reference = v_reference,
         fonepay_status = 'creating',
         fonepay_initiated_at = v_now,
         payment_expires_at = coalesce(v_order.payment_expires_at,v_now + interval '15 minutes'),
         updated_at = v_now
   where id = v_order.id;

  return jsonb_build_object(
    'state','claimed','reference',v_reference,'amount',v_order.total,
    'order_id',v_order.id,'order_number',v_order.order_number,
    'payment_expires_at',coalesce(v_order.payment_expires_at,v_now + interval '15 minutes')
  );
end;
$function$;
