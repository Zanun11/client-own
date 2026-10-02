-- =========================================
-- E-COMMERCE DATABASE SCHEMA
-- HOUSE PAINTING COMPANY
-- SUPABASE / POSTGRESQL
-- =========================================

create extension if not exists "pgcrypto";


-- =========================================
-- 1. COLORS
-- =========================================

create table public.colors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    hex_code text not null,
    category text not null,
    description text,
    finish_types text[] not null default '{}',
    created_at timestamptz not null default now(),

    constraint colors_hex_code_format
        check (hex_code ~ '^#[0-9A-Fa-f]{6}$')
);


-- =========================================
-- 2. PRODUCTS
-- =========================================

create table public.products (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    base_price numeric(12,2) not null,
    paint_type text not null,
    size_options text[] not null default '{}',
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint products_price_positive
        check (base_price >= 0),

    constraint products_paint_type
        check (
            paint_type in (
                'Interior',
                'Exterior',
                'Masonry'
            )
        )
);


-- =========================================
-- 3. PRODUCT VARIANTS
-- =========================================

create table public.product_variants (
    id uuid primary key default gen_random_uuid(),

    product_id uuid not null
        references public.products(id)
        on delete cascade,

    color_id uuid not null
        references public.colors(id)
        on delete restrict,

    stock_status text not null default 'In Stock',
    image_url text,

    created_at timestamptz not null default now(),

    constraint product_variants_stock_status
        check (
            stock_status in (
                'In Stock',
                'Out of Stock',
                'Low Stock'
            )
        )
);


-- =========================================
-- 4. CART ITEMS
-- =========================================

create table public.cart_items (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    variant_id uuid not null
        references public.product_variants(id)
        on delete cascade,

    quantity integer not null default 1,
    selected_size text not null,
    selected_finish text not null,

    created_at timestamptz not null default now(),

    constraint cart_items_quantity_positive
        check (quantity > 0)
);


-- =========================================
-- 5. ORDERS
-- =========================================

create table public.orders (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete restrict,

    total_amount numeric(12,2) not null,

    status text not null default 'Pending',

    payment_status text not null default 'Pending',

    delivery_address text not null,

    created_at timestamptz not null default now(),

    constraint orders_total_positive
        check (total_amount >= 0),

    constraint orders_status
        check (
            status in (
                'Pending',
                'Confirmed',
                'Processing',
                'Shipped',
                'Delivered',
                'Cancelled'
            )
        ),

    constraint orders_payment_status
        check (
            payment_status in (
                'Pending',
                'Paid',
                'Failed',
                'Refunded'
            )
        )
);


-- =========================================
-- 6. ORDER ITEMS
-- =========================================

create table public.order_items (
    id uuid primary key default gen_random_uuid(),

    order_id uuid not null
        references public.orders(id)
        on delete cascade,

    variant_id uuid not null
        references public.product_variants(id)
        on delete restrict,

    quantity integer not null,

    selected_size text not null,

    selected_finish text not null,

    unit_price numeric(12,2) not null,

    created_at timestamptz not null default now(),

    constraint order_items_quantity_positive
        check (quantity > 0),

    constraint order_items_price_positive
        check (unit_price >= 0)
);


-- =========================================
-- INDEXES
-- =========================================

create index idx_product_variants_product_id
    on public.product_variants(product_id);

create index idx_product_variants_color_id
    on public.product_variants(color_id);

create index idx_cart_items_user_id
    on public.cart_items(user_id);

create index idx_cart_items_variant_id
    on public.cart_items(variant_id);

create index idx_orders_user_id
    on public.orders(user_id);

create index idx_orders_status
    on public.orders(status);

create index idx_order_items_order_id
    on public.order_items(order_id);

create index idx_order_items_variant_id
    on public.order_items(variant_id);
