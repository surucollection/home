-- Configurable COD advance and explicit preorder payment modes
alter table public.invoice_settings add column if not exists cod_advance_amount numeric(12,2) not null default 300;
update public.invoice_settings set cod_advance_amount=case when cod_advance_amount is null or cod_advance_amount<0 then 300 else cod_advance_amount end where id=true;

create or replace function public.get_checkout_payment_settings()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return (select jsonb_build_object('cod_advance_amount',greatest(0,coalesce(cod_advance_amount,300)))
          from public.invoice_settings where id=true);
end;
$$;
revoke all on function public.get_checkout_payment_settings() from public,anon,authenticated;
grant execute on function public.get_checkout_payment_settings() to authenticated;

create or replace function public.apply_cod_advance_setting() returns trigger language plpgsql security definer set search_path='' as $$
declare v_amount numeric(12,2);
begin
 if new.payment_method='cod' and not exists(select 1 from public.order_items oi where oi.order_id=new.id and oi.is_preorder=true) then
   select greatest(0,coalesce(cod_advance_amount,300)) into v_amount from public.invoice_settings where id=true;
   v_amount:=least(coalesce(new.total,0),coalesce(v_amount,300));
   new.cod_advance_required:=v_amount;
   if coalesce(new.cod_advance_payment_status,'')='' or new.cod_advance_payment_status='not_required' then new.cod_advance_payment_status:=case when v_amount>0 then 'pending' else 'paid' end; end if;
   new.cod_balance_due:=greatest(0,coalesce(new.total,0)-v_amount);
 elsif new.payment_method<>'cod' then
   new.cod_advance_required:=0; new.cod_balance_due:=0; new.cod_advance_paid:=0; new.cod_advance_payment_status:='not_required';
 end if;
 return new;
end; $$;
revoke all on function public.apply_cod_advance_setting() from public,anon,authenticated;
grant execute on function public.apply_cod_advance_setting() to postgres;
drop trigger if exists trg_apply_cod_advance_setting on public.orders;
create trigger trg_apply_cod_advance_setting before insert or update of payment_method,total,cod_advance_required,cod_advance_paid,cod_advance_payment_status on public.orders for each row execute function public.apply_cod_advance_setting();

alter table public.preorder_payment_intents add column if not exists payment_purpose text not null default 'cod_advance';
alter table public.preorder_payment_intents drop constraint if exists preorder_payment_intents_payment_purpose_check;
alter table public.preorder_payment_intents add constraint preorder_payment_intents_payment_purpose_check check(payment_purpose in ('full','cod_advance'));

create or replace function public.create_preorder_payment_intent(p_user_id uuid,p_customer jsonb,p_product_code text,p_size text default null,p_color text default null,p_qty integer default 1,p_balance_method text default 'cod',p_payment_method text default 'fonepay',p_customer_note text default null,p_payment_purpose text default 'cod_advance')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_customer_id uuid; v_product public.products%rowtype; v_variant public.product_sizes%rowtype; v_variant_found boolean; v_percent numeric; v_regular numeric(12,2); v_discount numeric(12,2); v_total numeric(12,2); v_advance numeric(12,2); v_balance numeric(12,2); v_intent uuid;
begin
 if p_user_id is null then raise exception 'Authentication required'; end if;
 if p_payment_purpose not in ('full','cod_advance') then raise exception 'Unsupported preorder payment option'; end if;
 if p_payment_purpose='cod_advance' and p_balance_method<>'cod' then raise exception 'COD preorder must use cash on delivery for the remaining balance'; end if;
 if p_payment_purpose='full' then p_balance_method:='paid'; end if;
 if p_payment_method<>'fonepay' then raise exception 'This payment method is not currently available for preorder'; end if;
 if coalesce(p_qty,0)<1 then raise exception 'Quantity must be at least 1'; end if;
 if coalesce(trim(p_customer->>'name'),'')='' or coalesce(trim(p_customer->>'phone'),'')='' or coalesce(trim(p_customer->>'address'),'')='' or coalesce(trim(p_customer->>'city'),'')='' or coalesce(trim(p_customer->>'district'),'')='' or coalesce(trim(p_customer->>'province'),'')='' then raise exception 'Customer details are incomplete'; end if;
 select * into v_product from public.products where upper(product_code)=upper(trim(p_product_code)) and is_active=true and preorder_enabled=true for update;
 if not found then raise exception 'Product is unavailable for preorder'; end if;
 select * into v_variant from public.product_sizes where product_id=v_product.id and is_active=true and (p_size is null or upper(size)=upper(p_size)) and (p_color is null or upper(coalesce(color,''))=upper(p_color)) order by case when upper(coalesce(color,''))=upper(coalesce(p_color,'')) then 0 else 1 end,id limit 1 for update;
 v_variant_found:=found;
 if v_variant_found and coalesce(v_variant.stock,0)>0 then raise exception 'This option is in stock. Please use Buy Now instead'; end if;
 if v_variant_found and not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then raise exception 'Preorder is not enabled for this option'; end if;
 v_percent:=case when v_variant_found then coalesce(v_variant.preorder_advance_percent,v_product.preorder_advance_percent,30) else coalesce(v_product.preorder_advance_percent,30) end;
 if v_percent<1 or v_percent>100 then raise exception 'Invalid preorder advance configuration'; end if;
 select id into v_customer_id from public.customers where auth_user_id=p_user_id limit 1;
 if v_customer_id is null then
   insert into public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code) values(p_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(p_customer->>'district'),trim(p_customer->>'province'),nullif(trim(p_customer->>'postal_code'),'')) returning id into v_customer_id;
 else
   update public.customers set name=trim(p_customer->>'name'),phone=trim(p_customer->>'phone'),email=nullif(trim(p_customer->>'email'),''),address=trim(p_customer->>'address'),city=trim(p_customer->>'city'),district=trim(p_customer->>'district'),province=trim(p_customer->>'province'),postal_code=nullif(trim(p_customer->>'postal_code'),''),updated_at=now() where id=v_customer_id;
 end if;
 v_regular:=round(v_product.price*p_qty); v_discount:=round(v_regular*0.05); v_total:=round(v_regular-v_discount);
 if p_payment_purpose='full' then v_advance:=v_total; v_balance:=0; else v_advance:=round(v_total*v_percent/100); v_balance:=round(v_total-v_advance); end if;
 insert into public.preorder_payment_intents(auth_user_id,customer_id,product_id,product_code,size,color,quantity,total_amount,advance_amount,balance_amount,advance_percent,balance_method,payment_method,payment_provider,payment_purpose,customer_snapshot,customer_note)
 values(p_user_id,v_customer_id,v_product.id,v_product.product_code,case when v_variant_found then v_variant.size else nullif(trim(p_size),'') end,case when v_variant_found then v_variant.color else nullif(trim(p_color),'') end,p_qty,v_total,v_advance,v_balance,case when p_payment_purpose='full' then 100 else v_percent end,p_balance_method,p_payment_method,'fonepay',p_payment_purpose,jsonb_build_object('name',trim(p_customer->>'name'),'phone',trim(p_customer->>'phone'),'email',nullif(trim(p_customer->>'email'),''),'address',trim(p_customer->>'address'),'city',trim(p_customer->>'city'),'district',trim(p_customer->>'district'),'province',trim(p_customer->>'province'),'postal_code',nullif(trim(p_customer->>'postal_code'),'')),nullif(trim(coalesce(p_customer_note,'')),'') ) returning id into v_intent;
 return jsonb_build_object('success',true,'intent_id',v_intent,'amount',v_advance,'total',v_total,'balance_due',v_balance,'advance_percent',case when p_payment_purpose='full' then 100 else v_percent end,'payment_purpose',p_payment_purpose);
end; $$;
revoke all on function public.create_preorder_payment_intent(uuid,jsonb,text,text,text,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_preorder_payment_intent(uuid,jsonb,text,text,text,integer,text,text,text,text) to service_role;

drop function if exists public.create_preorder_payment_intent(uuid,jsonb,text,text,text,integer,text,text,text);

create or replace function public.finalize_preorder_payment_intent(p_intent_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_intent public.preorder_payment_intents%rowtype; v_order_id uuid; v_order_number text; v_regular numeric(12,2); v_discount numeric(12,2);
begin
 select * into v_intent from public.preorder_payment_intents where id=p_intent_id and auth_user_id=p_user_id for update;
 if not found then raise exception 'Preorder payment intent not found'; end if;
 if v_intent.payment_status<>'paid' then raise exception 'Payment is not verified'; end if;
 if v_intent.order_id is not null then return jsonb_build_object('success',true,'already_finalized',true,'order_id',v_intent.order_id,'order_number',(select order_number from public.orders where id=v_intent.order_id)); end if;
 v_regular:=round((select price from public.products where id=v_intent.product_id)*v_intent.quantity); v_discount:=round(v_regular*0.05);
 insert into public.orders(customer_id,customer_name,customer_phone,customer_email,shipping_address,city,district,province,postal_code,payment_method,customer_note,subtotal,discount,discount_amount,total,payment_status,order_status)
 select v_intent.customer_id,c.name,c.phone,c.email,c.address,c.city,c.district,c.province,c.postal_code,case when v_intent.payment_purpose='cod_advance' then 'cod' else 'fonepay' end,v_intent.customer_note,v_regular,v_discount,v_discount,v_intent.total_amount,case when v_intent.payment_purpose='cod_advance' then 'pending' else 'paid' end,'confirmed' from public.customers c where c.id=v_intent.customer_id returning id,order_number into v_order_id,v_order_number;
 insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price,is_preorder,preorder_discount,advance_amount,balance_amount,preorder_status,preorder_balance_method,advance_payment_status,advance_payment_reference,advance_payment_verified_at,advance_payment_note)
 select v_order_id,v_intent.product_id,v_intent.product_code,p.name,v_intent.size,v_intent.color,v_intent.quantity,p.price,v_intent.total_amount,true,v_discount,v_intent.advance_amount,v_intent.balance_amount,'confirmed',v_intent.balance_method,'verified',v_intent.payment_reference,v_intent.paid_at,'Verified by Fonepay' from public.products p where p.id=v_intent.product_id;
 update public.orders set cod_advance_required=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,cod_advance_paid=case when v_intent.payment_purpose='cod_advance' then v_intent.advance_amount else 0 end,cod_balance_due=case when v_intent.payment_purpose='cod_advance' then v_intent.balance_amount else 0 end,cod_advance_payment_status=case when v_intent.payment_purpose='cod_advance' then 'paid' else 'not_required' end where id=v_order_id;
 update public.preorder_payment_intents set order_id=v_order_id,finalized_at=now(),updated_at=now() where id=v_intent.id;
 return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'advance_paid',v_intent.advance_amount,'balance_due',v_intent.balance_amount,'payment_purpose',v_intent.payment_purpose);
end; $$;
