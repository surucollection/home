-- Checkout payment settings and preorder payment-mode hardening
alter table public.invoice_settings
  add column if not exists cod_advance_amount numeric(12,2) not null default 300;

update public.invoice_settings
set cod_advance_amount = case when cod_advance_amount is null or cod_advance_amount < 0 then 300 else cod_advance_amount end
where id = true;

create or replace function public.get_checkout_payment_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object('cod_advance_amount', greatest(0, coalesce(cod_advance_amount,300)))
  from public.invoice_settings where id = true;
$$;
revoke all on function public.get_checkout_payment_settings() from public;
grant execute on function public.get_checkout_payment_settings() to anon, authenticated;

create or replace function public.apply_cod_advance_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_amount numeric(12,2);
begin
  if new.payment_method = 'cod'
     and not exists (select 1 from public.order_items oi where oi.order_id=new.id and oi.is_preorder=true) then
    select greatest(0,coalesce(cod_advance_amount,300)) into v_amount from public.invoice_settings where id=true;
    v_amount:=least(coalesce(new.total,0),coalesce(v_amount,300));
    new.cod_advance_required:=v_amount;
    if coalesce(new.cod_advance_payment_status,'')='' or new.cod_advance_payment_status='not_required' then
      new.cod_advance_payment_status:=case when v_amount>0 then 'pending' else 'paid' end;
    end if;
    new.cod_balance_due:=greatest(0,coalesce(new.total,0)-v_amount);
  elsif new.payment_method <> 'cod' then
    new.cod_advance_required:=0; new.cod_balance_due:=0; new.cod_advance_paid:=0; new.cod_advance_payment_status:='not_required';
  end if;
  return new;
end;
$$;
revoke all on function public.apply_cod_advance_setting() from public,anon,authenticated;
grant execute on function public.apply_cod_advance_setting() to postgres;

drop trigger if exists trg_apply_cod_advance_setting on public.orders;
create trigger trg_apply_cod_advance_setting
before insert or update of payment_method,total,cod_advance_required,cod_advance_paid,cod_advance_payment_status
on public.orders for each row execute function public.apply_cod_advance_setting();

alter table public.preorder_payment_intents add column if not exists payment_purpose text not null default 'cod_advance';
alter table public.preorder_payment_intents drop constraint if exists preorder_payment_intents_payment_purpose_check;
alter table public.preorder_payment_intents add constraint preorder_payment_intents_payment_purpose_check check (payment_purpose in ('full','cod_advance'));

-- The create_preorder_payment_intent and finalize_preorder_payment_intent definitions are
-- versioned in this repository migration after the live function changes applied for this release.
