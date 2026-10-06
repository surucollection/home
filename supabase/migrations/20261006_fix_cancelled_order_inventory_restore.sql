-- Restore inventory reliably when cancelled order variants have a NULL color row.
-- The previous matching logic required exact color equality, so an order carrying
-- a color value could fail to match the generic (NULL color) inventory row.

create or replace function public.handle_order_cancellation(p_order_id uuid, p_action text, p_reason text default null, p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_item record;
  v_restored boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if not v_is_admin then
    select id into v_customer_id from public.customers where auth_user_id=v_uid limit 1;
    if v_customer_id is null or v_order.customer_id is distinct from v_customer_id then raise exception 'You are not authorized to manage this order'; end if;
    if p_action='cancel' then
      if v_order.order_status <> 'pending' then raise exception 'An order can only be cancelled while it is pending'; end if;
      if v_order.cancellation_status <> 'none' then raise exception 'This order already has a cancellation action'; end if;
      for v_item in
        select oi.product_id,oi.quantity,ps.id as size_id
        from public.order_items oi
        left join lateral (
          select id from public.product_sizes
          where product_id=oi.product_id and is_active=true
            and upper(coalesce(size,''))=upper(coalesce(oi.size,''))
            and (upper(coalesce(color,''))=upper(coalesce(oi.color,'')) or color is null)
          order by (case when upper(coalesce(color,''))=upper(coalesce(oi.color,'')) then 0 else 1 end), id limit 1
        ) ps on true
        where oi.order_id=v_order.id
      loop
        if v_item.size_id is not null then
          update public.product_sizes set stock=stock+v_item.quantity where id=v_item.size_id;
          insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id) values(v_item.product_id,v_item.size_id,v_item.quantity,'order_cancelled',v_order.id);
          v_restored:=true;
        end if;
      end loop;
      update public.orders set order_status='cancelled',cancellation_status='accepted',cancellation_reason=nullif(trim(p_reason),''),cancellation_requested_at=now(),cancellation_reviewed_at=now(),cancellation_admin_note='Cancelled by customer while order was pending',updated_at=now() where id=v_order.id;
      return jsonb_build_object('success',true,'status','cancelled','inventory_restored',v_restored);
    elsif p_action='request_cancellation' then
      if v_order.order_status <> 'confirmed' then raise exception 'Cancellation requests are only available after confirmation and before processing'; end if;
      if v_order.cancellation_status <> 'none' then raise exception 'A cancellation request already exists for this order'; end if;
      update public.orders set cancellation_status='requested',cancellation_reason=nullif(trim(p_reason),''),cancellation_requested_at=now(),updated_at=now() where id=v_order.id;
      return jsonb_build_object('success',true,'status','requested');
    else raise exception 'Invalid customer cancellation action'; end if;
  end if;

  if p_action='cancel' then
    if v_order.order_status='cancelled' then return jsonb_build_object('success',true,'status','cancelled','inventory_restored',false); end if;
    for v_item in
      select oi.product_id,oi.quantity,ps.id as size_id
      from public.order_items oi
      left join lateral (
        select id from public.product_sizes
        where product_id=oi.product_id and is_active=true
          and upper(coalesce(size,''))=upper(coalesce(oi.size,''))
          and (upper(coalesce(color,''))=upper(coalesce(oi.color,'')) or color is null)
        order by (case when upper(coalesce(color,''))=upper(coalesce(oi.color,'')) then 0 else 1 end), id limit 1
      ) ps on true
      where oi.order_id=v_order.id
    loop
      if v_item.size_id is not null then
        update public.product_sizes set stock=stock+v_item.quantity where id=v_item.size_id;
        insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id) values(v_item.product_id,v_item.size_id,v_item.quantity,'order_cancelled',v_order.id);
        v_restored:=true;
      end if;
    end loop;
    update public.orders set order_status='cancelled',cancellation_status='accepted',cancellation_reason=nullif(trim(p_reason),''),cancellation_reviewed_at=now(),cancellation_admin_note=nullif(trim(p_admin_note),'') ,updated_at=now() where id=v_order.id;
    return jsonb_build_object('success',true,'status','cancelled','inventory_restored',v_restored);
  end if;

  if p_action in ('accept_cancellation','reject_cancellation') then
    if v_order.cancellation_status <> 'requested' then raise exception 'There is no pending cancellation request for this order'; end if;
    if v_order.order_status <> 'confirmed' then raise exception 'Cancellation requests can only be reviewed before processing'; end if;
    if p_action='reject_cancellation' then
      update public.orders set cancellation_status='rejected',cancellation_reviewed_at=now(),cancellation_admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=v_order.id;
      return jsonb_build_object('success',true,'status','rejected');
    end if;
    for v_item in
      select oi.product_id,oi.quantity,ps.id as size_id
      from public.order_items oi
      left join lateral (
        select id from public.product_sizes
        where product_id=oi.product_id and is_active=true
          and upper(coalesce(size,''))=upper(coalesce(oi.size,''))
          and (upper(coalesce(color,''))=upper(coalesce(oi.color,'')) or color is null)
        order by (case when upper(coalesce(color,''))=upper(coalesce(oi.color,'')) then 0 else 1 end), id limit 1
      ) ps on true
      where oi.order_id=v_order.id
    loop
      if v_item.size_id is not null then
        update public.product_sizes set stock=stock+v_item.quantity where id=v_item.size_id;
        insert into public.inventory_movements(product_id,size_id,quantity_change,reason,reference_id) values(v_item.product_id,v_item.size_id,v_item.quantity,'order_cancelled',v_order.id);
        v_restored:=true;
      end if;
    end loop;
    update public.orders set order_status='cancelled',cancellation_status='accepted',cancellation_reviewed_at=now(),cancellation_admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=v_order.id;
    return jsonb_build_object('success',true,'status','cancelled','inventory_restored',v_restored);
  end if;
  raise exception 'Invalid administrator cancellation action';
end;
$function$;
