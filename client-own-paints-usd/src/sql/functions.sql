-- =========================================
-- SERVER-SIDE FUNCTIONS
-- Run this after src/schema.sql in the Supabase SQL editor.
--
-- The storefront calls these with `db.rpc(name, params)`; the local engine in
-- src/db.js implements the same behaviour in JavaScript, so the front-end code
-- works unchanged against either backend.
-- =========================================

-- ---------------------------------------------------------------- place_order
-- Turns the caller's basket into an order + order line items, pricing each line
-- from products.base_price and the size multiplier, then empties the basket.
create or replace function public.place_order(
    p_user_id uuid,
    p_delivery_address text,
    p_payment_method text default 'card'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order_id uuid;
    v_subtotal numeric(12,2);
    v_tax numeric(12,2);
    v_shipping numeric(12,2);
    v_total numeric(12,2);
    v_row record;
begin
    if auth.uid() is not null and auth.uid() <> p_user_id then
        raise exception 'you can only place orders for your own account' using errcode = '42501';
    end if;

    if coalesce(length(trim(p_delivery_address)), 0) < 8 then
        raise exception 'delivery address must be at least 8 characters' using errcode = '22023';
    end if;

    if not exists (select 1 from public.cart_items where user_id = p_user_id) then
        raise exception 'cart is empty' using errcode = '22023';
    end if;

    if exists (
        select 1
        from public.cart_items ci
        join public.product_variants pv on pv.id = ci.variant_id
        where ci.user_id = p_user_id
          and pv.stock_status = 'Out of Stock'
    ) then
        raise exception 'one of the items in your basket is out of stock' using errcode = '22023';
    end if;

    select sum(round(p.base_price * ci.quantity, 2))
      into v_subtotal
      from public.cart_items ci
      join public.product_variants pv on pv.id = ci.variant_id
      join public.products p on p.id = pv.product_id
     where ci.user_id = p_user_id;

    v_tax := round(v_subtotal * 0.0825, 2);
    v_shipping := case when v_subtotal >= 75 then 0 else 6.95 end;
    v_total := round(v_subtotal + v_tax + v_shipping, 2);

    insert into public.orders (user_id, total_amount, status, payment_status, delivery_address)
    values (
        p_user_id,
        v_total,
        'Pending',
        case when p_payment_method = 'invoice' then 'Pending' else 'Paid' end,
        trim(p_delivery_address)
    )
    returning id into v_order_id;

    for v_row in
        select ci.variant_id,
               ci.quantity,
               ci.selected_size,
               ci.selected_finish,
               round(
                   p.base_price * (
                       case ci.selected_size
                           when '500ml' then 0.28
                           when '1L' then 0.38
                           when '2.5L' then 0.72
                           when '5L' then 1
                           when '10L' then 1.78
                           else 1
                       end
                   ), 2
               ) as unit_price
          from public.cart_items ci
          join public.product_variants pv on pv.id = ci.variant_id
          join public.products p on p.id = pv.product_id
         where ci.user_id = p_user_id
    loop
        insert into public.order_items (
            order_id, variant_id, quantity, selected_size, selected_finish, unit_price
        ) values (
            v_order_id, v_row.variant_id, v_row.quantity, v_row.selected_size,
            v_row.selected_finish, v_row.unit_price
        );
    end loop;

    delete from public.cart_items where user_id = p_user_id;

    return jsonb_build_object(
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'tax', v_tax,
        'shipping', v_shipping,
        'total_amount', v_total
    );
end;
$$;

-- ------------------------------------------------------------------ merge_cart
-- Folds an anonymous shopper's basket into the account they just signed in with.
create or replace function public.merge_cart(p_from_user uuid, p_to_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_moved integer := 0;
    v_row record;
begin
    if auth.uid() is not null and auth.uid() <> p_to_user then
        raise exception 'you can only merge into your own cart' using errcode = '42501';
    end if;

    for v_row in select * from public.cart_items where user_id = p_from_user loop
        update public.cart_items
           set quantity = quantity + v_row.quantity
         where user_id = p_to_user
           and variant_id = v_row.variant_id
           and selected_size = v_row.selected_size
           and selected_finish = v_row.selected_finish;

        if not found then
            update public.cart_items set user_id = p_to_user where id = v_row.id;
        else
            delete from public.cart_items where id = v_row.id;
        end if;

        v_moved := v_moved + 1;
    end loop;

    return jsonb_build_object('moved', v_moved);
end;
$$;

-- -------------------------------------------------------- advance_order_status
-- The warehouse side of the shop. The check constraint on orders.status is the
-- single source of truth for which statuses exist.
create or replace function public.advance_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order public.orders;
begin
    -- This is the warehouse side of the shop. A real deployment would gate it behind an
    -- admin role (or an Edge Function holding the service key); as a demo it at least
    -- requires a signed-in session, and EXECUTE is revoked from anon below.
    if auth.uid() is null then
        raise exception 'sign in to change an order status' using errcode = '42501';
    end if;

    update public.orders set status = p_status where id = p_order_id returning * into v_order;
    if v_order is null then
        raise exception 'order % not found', p_order_id using errcode = 'P0002';
    end if;
    return v_order;
end;
$$;

-- ---------------------------------------------------------- set_payment_status
create or replace function public.set_payment_status(
    p_order_id uuid,
    p_payment_status text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order public.orders;
begin
    if auth.uid() is null then
        raise exception 'sign in to change a payment status'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.orders
        where id = p_order_id
          and user_id = auth.uid()
    ) then
        raise exception 'order not found or not owned by this account'
            using errcode = '42501';
    end if;

    update public.orders
    set payment_status = p_payment_status
    where id = p_order_id
    returning * into v_order;

    if v_order is null then
        raise exception 'order % not found', p_order_id
            using errcode = 'P0002';
    end if;

    return v_order;
end;
$$;

-- ------------------------------------------------------------- reorder_to_cart
create or replace function public.reorder_to_cart(p_order_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_added integer := 0;
    v_row record;
begin
    if auth.uid() is not null and auth.uid() <> p_user_id then
        raise exception 'you can only reorder into your own account'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.orders
        where id = p_order_id
          and user_id = p_user_id
    ) then
        raise exception 'order not found or does not belong to this account'
            using errcode = '42501';
    end if;

    for v_row in
        select oi.variant_id,
               oi.quantity,
               oi.selected_size,
               oi.selected_finish
        from public.order_items oi
        join public.product_variants pv on pv.id = oi.variant_id
        where oi.order_id = p_order_id
          and pv.stock_status <> 'Out of Stock'
    loop
        insert into public.cart_items (
            user_id,
            variant_id,
            quantity,
            selected_size,
            selected_finish
        )
        values (
            p_user_id,
            v_row.variant_id,
            v_row.quantity,
            v_row.selected_size,
            v_row.selected_finish
        );

        v_added := v_added + 1;
    end loop;

    return jsonb_build_object('added', v_added);
end;
$$;

-- ------------------------------------------------------------------ order_totals
create or replace function public.order_totals(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
    with items as (
        select sum(unit_price * quantity) as subtotal
          from public.order_items
         where order_id = p_order_id
    )
    select jsonb_build_object(
        'subtotal', subtotal,
        'tax', round(subtotal * 0.0825, 2),
        'shipping', case when subtotal >= 75 then 0 else 6.95 end,
        'total', round(subtotal * 1.0825 + case when subtotal >= 75 then 0 else 6.95 end, 2)
    ) from items;
$$;

-- ------------------------------------------------ row level security policies
alter table public.colors enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "catalogue is public" on public.colors for select using (true);
create policy "catalogue is public" on public.products for select using (true);
create policy "catalogue is public" on public.product_variants for select using (true);

create policy "own cart" on public.cart_items
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own orders" on public.orders
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own order items" on public.order_items
    for select using (
        exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    );

-- =========================================
-- AFTER SCHEMA + POLICIES: RPCs FOR A REAL PROJECT
-- =========================================

-- ------------------------------------------------------------ seed_demo_orders
-- The SQL twin of the demo history src/seed.js builds for the local engine.
-- It always writes to the caller's own account (auth.uid()), so an anon key is
-- enough — no service role in the browser, and no way to touch anyone else's rows.
-- Idempotent: an order with the same address + status is left alone, so clicking
-- "Load demo orders" twice does not double up.
create or replace function public.seed_demo_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_orders integer := 0;
    v_items integer := 0;
    v_added integer := 0;
    v_spec record;
    v_order_id uuid;
    v_subtotal numeric(12,2);
    v_tax numeric(12,2);
    v_shipping numeric(12,2);
begin
    if v_user is null then
        raise exception 'sign in first — demo orders belong to an account' using errcode = '42501';
    end if;

    for v_spec in
        select * from (values
            (34::numeric,  'Delivered',  'Paid',    '18 Alder Row, Portland, OR 97214'),
            (12::numeric,  'Shipped',    'Paid',    '18 Alder Row, Portland, OR 97214'),
            (3::numeric,   'Processing', 'Paid',    '2210 NE Fremont St, Portland, OR 97212'),
            (0.4::numeric, 'Pending',    'Pending', '2210 NE Fremont St, Portland, OR 97212')
        ) as t(days_ago, status, payment_status, address)
    loop
        if exists (
            select 1 from public.orders o
             where o.user_id = v_user
               and o.delivery_address = v_spec.address
               and o.status = v_spec.status
        ) then
            continue;
        end if;

        insert into public.orders (user_id, total_amount, status, payment_status, delivery_address, created_at)
        values (
            v_user,
            0,
            v_spec.status,
            v_spec.payment_status,
            v_spec.address,
            now() - (v_spec.days_ago * interval '1 day')
        )
        returning id into v_order_id;

        insert into public.order_items (order_id, variant_id, quantity, selected_size, selected_finish, unit_price, created_at)
        select v_order_id,
               pv.id,
               spec.quantity,
               spec.selected_size,
               spec.selected_finish,
               round(
                   p.base_price * (
                       case spec.selected_size
                           when '500ml' then 0.28
                           when '1L' then 0.38
                           when '2.5L' then 0.72
                           when '5L' then 1
                           when '10L' then 1.78
                           else 1
                       end
                   ), 2
               ),
               now() - (v_spec.days_ago * interval '1 day')
          from (values
                ('Delivered',  'Signature Interior Emulsion',         'Coastal Sage',   '5L',   'Eggshell', 3),
                ('Delivered',  'Multi-Surface Primer & Undercoat',    'Ivory White',    '5L',   'Matte',    1),
                ('Delivered',  'Ultra-Matte Ceiling Paint',           'Warm Alabaster', '10L',  'Matte',    1),
                ('Shipped',    'Weathershield Exterior Satin',        'Midnight Navy',  '5L',   'Satin',    2),
                ('Shipped',    'Exterior Gloss Wood & Metal',         'Charcoal Slate', '2.5L', 'Gloss',    2),
                ('Processing', 'Masonry Shield Smooth',               'Terracotta Clay','10L',  'Matte',    4),
                ('Processing', 'Damp-Block Masonry Primer',           'Burnt Sienna',   '5L',   'Matte',    2),
                ('Pending',    'Washable Silk Interior',              'Heritage Ochre', '2.5L', 'Eggshell', 1)
               ) as spec(order_status, product_title, color_name, selected_size, selected_finish, quantity)
          join public.products p on p.title = spec.product_title
          join public.colors c on c.name = spec.color_name
          join public.product_variants pv on pv.product_id = p.id and pv.color_id = c.id
         where spec.order_status = v_spec.status;
        get diagnostics v_added = row_count;
        v_items := v_items + v_added;

        select coalesce(sum(oi.unit_price * oi.quantity), 0)
          into v_subtotal
          from public.order_items oi
         where oi.order_id = v_order_id;

        v_tax := round(v_subtotal * 0.0825, 2);
        v_shipping := case when v_subtotal >= 75 then 0 else 6.95 end;

        update public.orders
           set total_amount = round(v_subtotal + v_tax + v_shipping, 2)
         where id = v_order_id;

        v_orders := v_orders + 1;
    end loop;

    return jsonb_build_object('orders', v_orders, 'order_items', v_items, 'user_id', v_user);
end;
$$;

-- =========================================
-- EXECUTE GRANTS
-- =========================================
-- Supabase grants EXECUTE to PUBLIC by default, and every role is in PUBLIC, so
-- revoking from `anon` alone would do nothing. The warehouse-side functions are
-- re-granted to `authenticated` only.

revoke execute on function public.advance_order_status(uuid, text) from public;
revoke execute on function public.set_payment_status(uuid, text) from public;
revoke execute on function public.seed_demo_orders() from public;
grant execute on function public.advance_order_status(uuid, text) to authenticated;
grant execute on function public.set_payment_status(uuid, text) to authenticated;
grant execute on function public.seed_demo_orders() to authenticated;

-- The customer-facing functions must be callable by an anonymous shopper, because
-- an anonymous sign-in is still how a first-time visitor gets a basket.
grant execute on function public.place_order(uuid, text, text) to anon, authenticated;
grant execute on function public.merge_cart(uuid, uuid) to anon, authenticated;
grant execute on function public.reorder_to_cart(uuid, uuid) to anon, authenticated;
grant execute on function public.order_totals(uuid) to anon, authenticated;
