-- Customer-owned preorder advance submission.
-- This records a manual reference/proof for admin review. Gateway verification is separate.
create or replace function public.submit_preorder_advance(
  p_item_id uuid,
  p_reference text default null,
  p_proof_url text default null
)
returns public.order_items
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item public.order_items;
begin
  select oi.*
    into v_item
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.id = p_item_id
     and oi.is_preorder = true
     and o.customer_id = (
       select c.id
         from public.customers c
        where c.auth_user_id = auth.uid()
        limit 1
     )
   for update of oi;

  if not found then
    raise exception 'Pre-order not found or access denied';
  end if;

  if v_item.advance_payment_status not in ('pending', 'rejected', 'submitted') then
    raise exception 'Advance submission is not allowed in the current state';
  end if;

  if coalesce(trim(p_reference), '') = '' and coalesce(trim(p_proof_url), '') = '' then
    raise exception 'Provide a payment reference or proof';
  end if;

  update public.order_items
     set advance_payment_reference = nullif(trim(p_reference), ''),
         advance_payment_proof_url = nullif(trim(p_proof_url), ''),
         advance_payment_submitted_at = now(),
         advance_payment_status = 'submitted',
         preorder_status = 'awaiting_advance',
         advance_payment_verified_at = null,
         advance_payment_verified_by = null
   where id = p_item_id
   returning * into v_item;

  return v_item;
end;
$function$;

revoke all on function public.submit_preorder_advance(uuid, text, text) from public, anon;
grant execute on function public.submit_preorder_advance(uuid, text, text) to authenticated;
