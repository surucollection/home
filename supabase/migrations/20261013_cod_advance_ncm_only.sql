-- Normal COD advance is calculated by place_order from the applicable
-- NCM delivery rate. Remove the legacy fixed invoice_settings override.
create or replace function public.apply_cod_advance_setting()
returns trigger
language plpgsql
as $$
begin
  if new.payment_method='cod' and not exists (
    select 1 from public.order_items oi where oi.order_id=new.id and oi.is_preorder=true
  ) then
    new.cod_advance_required:=coalesce(new.cod_advance_required,0);
    new.cod_balance_due:=greatest(0,coalesce(new.total,0)-coalesce(new.cod_advance_required,0));
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
$$;
