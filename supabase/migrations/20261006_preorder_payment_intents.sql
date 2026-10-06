create table if not exists public.preorder_payment_intents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  customer_id uuid,
  product_id uuid not null references public.products(id),
  product_code text not null,
  size text,
  color text,
  quantity integer not null check (quantity > 0),
  total_amount numeric(12,2) not null check (total_amount > 0),
  advance_amount numeric(12,2) not null check (advance_amount > 0),
  balance_amount numeric(12,2) not null check (balance_amount >= 0),
  advance_percent numeric(6,2) not null,
  balance_method text not null check (balance_method in ('online','cod')),
  payment_method text not null,
  payment_provider text not null default 'fonepay',
  payment_status text not null default 'pending' check (payment_status in ('pending','initiated','paid','failed','expired')),
  payment_reference text unique,
  payment_trace_id text,
  payment_response jsonb,
  customer_snapshot jsonb not null,
  customer_note text,
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  finalized_at timestamptz
);

alter table public.preorder_payment_intents enable row level security;
create policy "No direct client access" on public.preorder_payment_intents
for all to anon, authenticated using(false) with check(false);

create or replace function public.create_preorder_payment_intent(
  p_user_id uuid,p_customer jsonb,p_product_code text,p_size text default null,p_color text default null,
  p_qty integer default 1,p_balance_method text default 'online',p_payment_method text default 'fonepay',p_customer_note text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_customer_id uuid; v_product public.products%rowtype; v_variant public.product_sizes%rowtype;
v_variant_found boolean; v_percent numeric; v_regular numeric(12,2); v_discount numeric(12,2); v_total numeric(12,2);
v_advance numeric(12,2); v_balance numeric(12,2); v_intent uuid;
begin
 if p_user_id is null then raise exception 'Authentication required'; end if;
 if p_balance_method not in ('online','cod') then raise exception 'Remaining balance method must be online or cod'; end if;
 if p_payment_method <> 'fonepay' then raise exception 'This payment method is not currently available for preorder advance'; end if;
 if coalesce(p_qty,0)<1 then raise exception 'Quantity must be at least 1'; end if;
 if coalesce(trim(p_customer->>'name'),'')='' or coalesce(trim(p_customer->>'phone'),'')='' or coalesce(trim(p_customer->>'address'),'')='' or coalesce(trim(p_customer->>'city'),'')='' or coalesce(trim(p_customer->>'district'),'')='' or coalesce(trim(p_customer->>'province'),'')='' then raise exception 'Customer details are incomplete'; end if;
 select * into v_product from public.products where upper(product_code)=upper(trim(p_product_code)) and is_active=true and preorder_enabled=true for update;
 if not found then raise exception 'Product is unavailable for preorder'; end if;
 select * into v_variant from public.product_sizes where product_id=v_product.id and is_active=true
 and (p_size is null or upper(size)=upper(p_size)) and (p_color is null or upper(coalesce(color,''))=upper(p_color))
 order by case when upper(coalesce(color,''))=upper(coalesce(p_color,'')) then 0 else 1 end,id limit 1 for update;
 v_variant_found:=found;
 if v_variant_found and coalesce(v_variant.stock,0)>0 then raise exception 'This option is in stock. Please use Buy Now instead'; end if;
 if v_variant_found and not coalesce(v_variant.preorder_enabled,v_product.preorder_enabled,false) then raise exception 'Preorder is not enabled for this option'; end if;
 v_percent:=case when v_variant_found then coalesce(v_variant.preorder_advance_percent,v_product.preorder_advance_percent,30) else coalesce(v_product.preorder_advance_percent,30) end;
 if v_percent<1 or v_percent>100 then raise exception 'Invalid preorder advance configuration'; end if;
 select id into v_customer_id from public.customers where auth_user_id=p_user_id limit 1;
 if v_customer_id is null then
   insert into public.customers(auth_user_id,name,phone,email,address,city,district,province,postal_code)
   values(p_user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),nullif(trim(p_customer->>'email'),''),
   trim(p_customer->>'address'),trim(p_customer->>'city'),trim(p_customer->>'district'),trim(p_customer->>'province'),nullif(trim(p_customer->>'postal_code'),''))
   returning id into v_customer_id;
 else
   update public.customers set name=trim(p_customer->>'name'),phone=trim(p_customer->>'phone'),email=nullif(trim(p_customer->>'email'),''),
   address=trim(p_customer->>'address'),city=trim(p_customer->>'city'),district=trim(p_customer->>'district'),province=trim(p_customer->>'province'),
   postal_code=nullif(trim(p_customer->>'postal_code'),'') ,updated_at=now() where id=v_customer_id;
 end if;
 v_regular:=round(v_product.price*p_qty); v_discount:=round(v_regular*0.05); v_total:=round(v_regular-v_discount);
 v_advance:=round(v_total*v_percent/100); v_balance:=round(v_total-v_advance);
 insert into public.preorder_payment_intents(auth_user_id,customer_id,product_id,product_code,size,color,quantity,total_amount,advance_amount,balance_amount,advance_percent,balance_method,payment_method,payment_provider,customer_snapshot,customer_note)
 values(p_user_id,v_customer_id,v_product.id,v_product.product_code,case when v_variant_found then v_variant.size else nullif(trim(p_size),'') end,
 case when v_variant_found then v_variant.color else nullif(trim(p_color),'') end,p_qty,v_total,v_advance,v_balance,v_percent,p_balance_method,p_payment_method,'fonepay',
 jsonb_build_object('name',trim(p_customer->>'name'),'phone',trim(p_customer->>'phone'),'email',nullif(trim(p_customer->>'email'),''),'address',trim(p_customer->>'address'),'city',trim(p_customer->>'city'),'district',trim(p_customer->>'district'),'province',trim(p_customer->>'province'),'postal_code',nullif(trim(p_customer->>'postal_code'),'')),
 nullif(trim(coalesce(p_customer_note,'')),'')
 ) returning id into v_intent;
 return jsonb_build_object('success',true,'intent_id',v_intent,'amount',v_advance,'total',v_total,'balance_due',v_balance,'advance_percent',v_percent);
end; $$;

create or replace function public.finalize_preorder_payment_intent(p_intent_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_intent public.preorder_payment_intents%rowtype; v_order_id uuid; v_order_number text; v_regular numeric(12,2); v_discount numeric(12,2);
begin
 select * into v_intent from public.preorder_payment_intents where id=p_intent_id and auth_user_id=p_user_id for update;
 if not found then raise exception 'Preorder payment intent not found'; end if;
 if v_intent.payment_status<>'paid' then raise exception 'Advance payment is not verified'; end if;
 if v_intent.order_id is not null then return jsonb_build_object('success',true,'already_finalized',true,'order_id',v_intent.order_id,'order_number',(select order_number from public.orders where id=v_intent.order_id)); end if;
 v_regular:=round((select price from public.products where id=v_intent.product_id)*v_intent.quantity);
 v_discount:=round(v_regular*0.05);
 insert into public.orders(customer_id,customer_name,customer_phone,customer_email,shipping_address,city,district,province,postal_code,payment_method,customer_note,subtotal,discount,discount_amount,total,payment_status,order_status)
 select v_intent.customer_id,c.name,c.phone,c.email,c.address,c.city,c.district,c.province,c.postal_code,'fonepay',v_intent.customer_note,v_regular,v_discount,v_discount,v_intent.total_amount,'paid','confirmed'
 from public.customers c where c.id=v_intent.customer_id returning id,order_number into v_order_id,v_order_number;
 insert into public.order_items(order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price,is_preorder,preorder_discount,advance_amount,balance_amount,preorder_status,preorder_balance_method,advance_payment_status,advance_payment_reference,advance_payment_verified_at,advance_payment_note)
 select v_order_id,v_intent.product_id,v_intent.product_code,p.name,v_intent.size,v_intent.color,v_intent.quantity,p.price,v_intent.total_amount,true,v_discount,v_intent.advance_amount,v_intent.balance_amount,'confirmed',v_intent.balance_method,'verified',v_intent.payment_reference,v_intent.paid_at,'Verified by Fonepay'
 from public.products p where p.id=v_intent.product_id;
 update public.preorder_payment_intents set order_id=v_order_id,finalized_at=now(),updated_at=now() where id=v_intent.id;
 return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'advance_paid',v_intent.advance_amount,'balance_due',v_intent.balance_amount);
end; $$;

revoke all on function public.create_preorder_payment_intent(uuid,jsonb,text,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.finalize_preorder_payment_intent(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_preorder_payment_intent(uuid,jsonb,text,text,text,integer,text,text,text) to service_role;
grant execute on function public.finalize_preorder_payment_intent(uuid,uuid) to service_role;