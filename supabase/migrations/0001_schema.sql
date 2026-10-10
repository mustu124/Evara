-- Evara Studios — core schema, functions and Row Level Security.
-- Safe to run once on a fresh Supabase project (SQL editor or `supabase db push`).

-- ───────────────────────────── helpers ─────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────── profiles ─────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a non-privileged profile. Admins are promoted only
-- by the server-side script (scripts/create-admin.mjs) using the secret key.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ───────────────────────────── catalog ─────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_coming_soon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index categories_parent_idx on public.categories (parent_id);
create index categories_sort_idx on public.categories (sort_order);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_sort_idx on public.collections (sort_order);
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_coming_soon boolean not null default false,
  is_bestseller boolean not null default false,
  -- [{ "label": "Dimensions", "value": "7.5 cm diameter x 4.7 cm height" }, ...]
  specifications jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  -- Inventory is counted in individual pieces; a pack variant consumes
  -- quantity x pack_quantity pieces. Untracked products are made to order.
  track_inventory boolean not null default false,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_bestseller_idx on public.products (is_bestseller) where is_bestseller;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_collections (
  product_id uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  primary key (product_id, collection_id)
);
create index product_collections_collection_idx on public.product_collections (collection_id);

-- Non-price choices (design, colour, fragrance). Each option has values that
-- can individually be unavailable or "coming soon".
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'other' check (kind in ('design', 'colour', 'fragrance', 'other')),
  sort_order integer not null default 0,
  unique (product_id, name)
);
create index product_options_product_idx on public.product_options (product_id);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,
  value text not null check (char_length(value) between 1 and 80),
  is_available boolean not null default true,
  is_coming_soon boolean not null default false,
  sort_order integer not null default 0,
  unique (option_id, value)
);
create index product_option_values_option_idx on public.product_option_values (option_id);

-- Price-bearing purchasable units (pack sizes). Prices live only here.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  pack_quantity integer not null default 1 check (pack_quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= price),
  sku text unique,
  is_available boolean not null default true,
  is_coming_soon boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, label)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- "<bucket>/<object path>", e.g. product-images/daisy/blush-pink.jpeg
  storage_path text not null,
  alt text not null default '',
  -- Optional link to an option value so choosing e.g. a hue shows its photo.
  option_value_id uuid references public.product_option_values (id) on delete set null,
  show_in_gallery boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create index product_images_gallery_idx on public.product_images (show_in_gallery) where show_in_gallery;

-- ───────────────────────────── orders ─────────────────────────────

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  address_line1 text not null check (char_length(address_line1) between 3 and 200),
  address_line2 text check (address_line2 is null or char_length(address_line2) <= 200),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  admin_note text,
  currency text not null default 'INR',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  stock_deducted boolean not null default false,
  client_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);
create index orders_client_hash_idx on public.orders (client_hash, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Line items snapshot names, options and prices at the time of ordering so
-- later catalog edits never change historical orders.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_label text not null,
  pack_quantity integer not null default 1 check (pack_quantity > 0),
  -- [{ "name": "Hue", "value": "Blush Pink" }, ...]
  selected_options jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_options) = 'array'),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  compare_at_price numeric(10, 2),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  image_path text,
  deducted_pieces integer not null default 0 check (deducted_pieces >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ───────────────────────────── content ─────────────────────────────

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 1 and 120),
  author_location text,
  quote text not null check (char_length(quote) between 1 and 1000),
  rating smallint check (rating is null or rating between 1 and 5),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger testimonials_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

-- ───────────────────────── order creation ─────────────────────────
-- The only way an order is created. Runs with the server's secret key, never
-- from the browser. Everything that matters (prices, availability, stock,
-- totals) is read from the database here; the caller supplies only ids,
-- quantities and customer details.

create or replace function public.create_order(
  p_customer jsonb,
  p_items jsonb,
  p_client_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_idx integer := -1;
  v_variant_id uuid;
  v_value_ids uuid[];
  v_qty integer;
  v_row record;
  v_option_count integer;
  v_selected_count integer;
  v_selected_options_distinct integer;
  v_bad_value text;
  v_selected jsonb;
  v_image text;
  v_errors jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_needed jsonb := '{}'::jsonb;
  v_need integer;
  v_subtotal numeric(12, 2) := 0;
  v_shipping numeric(12, 2) := 0;
  v_store jsonb;
  v_reference text;
  v_order public.orders;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_phone text := p_customer ->> 'phone';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_cart',
      'message', 'Your cart is empty or has too many items.');
  end if;

  -- Abuse protection: cap orders per client address and per phone number.
  if (p_client_hash is not null and (
        select count(*) from public.orders
        where client_hash = p_client_hash and created_at > now() - interval '1 hour') >= 5)
     or (select count(*) from public.orders
         where customer_phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited',
      'message', 'Too many orders were placed recently. Please try again in a little while.');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;

    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_qty := (v_item ->> 'quantity')::integer;
      select coalesce(array_agg(distinct e::uuid), '{}') into v_value_ids
      from jsonb_array_elements_text(coalesce(v_item -> 'option_value_ids', '[]'::jsonb)) as e;
    exception when others then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'invalid',
        'message', 'This item could not be read. Please remove it and add it again.');
      continue;
    end;

    if v_variant_id is null or v_qty is null or v_qty < 1 or v_qty > 50 then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'invalid',
        'message', 'Quantity must be between 1 and 50.');
      continue;
    end if;

    select p.id as product_id, p.name, p.status, p.is_coming_soon as product_coming_soon,
           p.track_inventory, p.stock_quantity,
           v.id as variant_id, v.label, v.pack_quantity, v.price, v.compare_at_price,
           v.is_available, v.is_coming_soon as variant_coming_soon
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_variant_id;

    if not found or v_row.status <> 'published' then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'not_found',
        'message', 'This product is no longer available.');
      continue;
    end if;

    if v_row.product_coming_soon or v_row.variant_coming_soon or not v_row.is_available then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'unavailable',
        'message', v_row.name || ' (' || v_row.label || ') is not available to order yet.');
      continue;
    end if;

    -- Exactly one available value must be chosen for every option of the product.
    select count(*) into v_option_count
      from public.product_options o where o.product_id = v_row.product_id;

    select count(*), count(distinct o.id),
           min(ov.value) filter (where ov.is_coming_soon or not ov.is_available),
           coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'value', ov.value)
                              order by o.sort_order, o.name), '[]'::jsonb)
      into v_selected_count, v_selected_options_distinct, v_bad_value, v_selected
      from public.product_option_values ov
      join public.product_options o on o.id = ov.option_id
     where ov.id = any (v_value_ids) and o.product_id = v_row.product_id;

    if v_selected_count <> coalesce(array_length(v_value_ids, 1), 0)
       or v_selected_count <> v_option_count
       or v_selected_options_distinct <> v_option_count then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'invalid_options',
        'message', 'Please re-select the options for ' || v_row.name || '.');
      continue;
    end if;

    if v_bad_value is not null then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'unavailable',
        'message', v_row.name || ': "' || v_bad_value || '" is not available to order yet.');
      continue;
    end if;

    if v_row.track_inventory then
      v_need := coalesce((v_needed ->> v_row.product_id::text)::integer, 0) + v_qty * v_row.pack_quantity;
      v_needed := v_needed || jsonb_build_object(v_row.product_id::text, v_need);
      if v_need > v_row.stock_quantity then
        v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'out_of_stock',
          'message', case when v_row.stock_quantity = 0
            then v_row.name || ' is currently out of stock.'
            else 'Only ' || v_row.stock_quantity || ' piece(s) of ' || v_row.name || ' are in stock.' end);
        continue;
      end if;
    end if;

    select i.storage_path into v_image
      from public.product_images i
     where i.product_id = v_row.product_id
     order by (i.option_value_id = any (v_value_ids)) desc nulls last, i.sort_order, i.created_at
     limit 1;

    v_subtotal := v_subtotal + v_row.price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_row.product_id,
      'variant_id', v_row.variant_id,
      'product_name', v_row.name,
      'variant_label', v_row.label,
      'pack_quantity', v_row.pack_quantity,
      'selected_options', v_selected,
      'unit_price', v_row.price,
      'compare_at_price', v_row.compare_at_price,
      'quantity', v_qty,
      'line_total', v_row.price * v_qty,
      'image_path', v_image);
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items',
      'message', 'Some items in your cart need attention.', 'errors', v_errors);
  end if;

  -- Optional flat shipping fee configured by the administrator.
  select value into v_store from public.site_settings where key = 'store';
  begin
    v_shipping := greatest(coalesce((v_store ->> 'shipping_fee')::numeric, 0), 0);
    if v_store ->> 'free_shipping_above' is not null
       and v_subtotal >= (v_store ->> 'free_shipping_above')::numeric then
      v_shipping := 0;
    end if;
  exception when others then
    v_shipping := 0;
  end;

  loop
    select 'EV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' ||
           string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
      into v_reference
      from generate_series(1, 5);
    exit when not exists (select 1 from public.orders where reference = v_reference);
  end loop;

  insert into public.orders (
    reference, customer_name, customer_phone, customer_email,
    address_line1, address_line2, city, state, pincode, customer_note,
    subtotal, shipping_amount, total, client_hash)
  values (
    v_reference,
    btrim(p_customer ->> 'name'),
    v_phone,
    nullif(btrim(coalesce(p_customer ->> 'email', '')), ''),
    btrim(p_customer ->> 'address_line1'),
    nullif(btrim(coalesce(p_customer ->> 'address_line2', '')), ''),
    btrim(p_customer ->> 'city'),
    btrim(p_customer ->> 'state'),
    p_customer ->> 'pincode',
    nullif(btrim(coalesce(p_customer ->> 'note', '')), ''),
    v_subtotal, v_shipping, v_subtotal + v_shipping, p_client_hash)
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_label, pack_quantity,
    selected_options, unit_price, compare_at_price, quantity, line_total, image_path)
  select v_order.id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
         l ->> 'product_name', l ->> 'variant_label', (l ->> 'pack_quantity')::integer,
         l -> 'selected_options', (l ->> 'unit_price')::numeric,
         (l ->> 'compare_at_price')::numeric, (l ->> 'quantity')::integer,
         (l ->> 'line_total')::numeric, l ->> 'image_path'
    from jsonb_array_elements(v_lines) as l;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'id', v_order.id,
    'reference', v_order.reference,
    'subtotal', v_order.subtotal,
    'shipping_amount', v_order.shipping_amount,
    'total', v_order.total,
    'items', v_lines));
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text) to service_role;

-- ───────────────────── stock follows order status ─────────────────────
-- A WhatsApp order is only a request, so stock is not touched when it is
-- created. Pieces are deducted when an administrator confirms the order and
-- returned if a confirmed order is later cancelled.

create or replace function public.orders_apply_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'processing', 'shipped', 'completed') and not new.stock_deducted then
    update public.order_items oi
       set deducted_pieces = oi.quantity * oi.pack_quantity
      from public.products p
     where oi.order_id = new.id and p.id = oi.product_id and p.track_inventory;

    update public.products p
       set stock_quantity = greatest(0, p.stock_quantity - s.pieces)
      from (select product_id, sum(deducted_pieces) as pieces
              from public.order_items
             where order_id = new.id and deducted_pieces > 0
             group by product_id) s
     where p.id = s.product_id;

    new.stock_deducted := true;
  elsif new.status = 'cancelled' and new.stock_deducted then
    update public.products p
       set stock_quantity = p.stock_quantity + s.pieces
      from (select product_id, sum(deducted_pieces) as pieces
              from public.order_items
             where order_id = new.id and deducted_pieces > 0
             group by product_id) s
     where p.id = s.product_id;

    update public.order_items set deducted_pieces = 0 where order_id = new.id;
    new.stock_deducted := false;
  end if;
  return new;
end;
$$;

create trigger orders_apply_stock before update of status on public.orders
  for each row execute function public.orders_apply_stock();

-- ───────────────────────── dashboard stats ─────────────────────────

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total_products', (select count(*) from public.products where status <> 'archived'),
    'active_products', (select count(*) from public.products where status = 'published'),
    'low_stock_products', (select count(*) from public.products
                            where track_inventory and status <> 'archived'
                              and stock_quantity <= low_stock_threshold),
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'pending'),
    -- Revenue counts only orders marked paid and not cancelled.
    'paid_revenue', (select coalesce(sum(total), 0) from public.orders
                      where payment_status = 'paid' and status <> 'cancelled'),
    'paid_revenue_30d', (select coalesce(sum(total), 0) from public.orders
                          where payment_status = 'paid' and status <> 'cancelled'
                            and created_at > now() - interval '30 days'),
    -- Accepted by the store but not yet paid.
    'awaiting_payment', (select coalesce(sum(total), 0) from public.orders
                          where payment_status = 'unpaid'
                            and status in ('confirmed', 'processing', 'shipped', 'completed')),
    -- Requests that have not been confirmed; never counted as revenue.
    'pending_value', (select coalesce(sum(total), 0) from public.orders where status = 'pending')
  );
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated, service_role;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.orders_apply_stock() from public, anon, authenticated;

-- ─────────────────────── Row Level Security ───────────────────────

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;
alter table public.testimonials enable row level security;

-- Table privileges are set explicitly, whatever the project's default
-- privileges are: start from nothing for the browser roles, then grant only
-- what each needs. RLS below then decides which rows.
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

grant select on public.categories, public.collections, public.products, public.product_collections,
  public.product_options, public.product_option_values, public.product_variants,
  public.product_images, public.site_settings, public.testimonials
  to anon, authenticated;

grant insert, update, delete on public.categories, public.collections, public.products,
  public.product_collections, public.product_options, public.product_option_values,
  public.product_variants, public.product_images, public.site_settings, public.testimonials
  to authenticated;

grant select on public.profiles to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- profiles: a user sees their own row; nobody edits roles through the API.
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- categories / collections
create policy "categories: public read active" on public.categories
  for select using (is_active or (select public.is_admin()));
create policy "categories: admin write" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "collections: public read active" on public.collections
  for select using (is_active or (select public.is_admin()));
create policy "collections: admin write" on public.collections
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- products and their children: public sees published products only.
create policy "products: public read published" on public.products
  for select using (status = 'published' or (select public.is_admin()));
create policy "products: admin write" on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_collections: public read published" on public.product_collections
  for select using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "product_collections: admin write" on public.product_collections
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_options: public read published" on public.product_options
  for select using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "product_options: admin write" on public.product_options
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_option_values: public read published" on public.product_option_values
  for select using (
    (select public.is_admin())
    or exists (
      select 1 from public.product_options o
      join public.products p on p.id = o.product_id
      where o.id = option_id and p.status = 'published'));
create policy "product_option_values: admin write" on public.product_option_values
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_variants: public read published" on public.product_variants
  for select using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "product_variants: admin write" on public.product_variants
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_images: public read published" on public.product_images
  for select using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "product_images: admin write" on public.product_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders: customer data is never public. Created only by create_order().
create policy "orders: admin read" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "orders: admin update" on public.orders
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_items: admin read" on public.order_items
  for select to authenticated using ((select public.is_admin()));

-- settings / testimonials
create policy "site_settings: public read public keys" on public.site_settings
  for select using (is_public or (select public.is_admin()));
create policy "site_settings: admin write" on public.site_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "testimonials: public read published" on public.testimonials
  for select using (is_published or (select public.is_admin()));
create policy "testimonials: admin write" on public.testimonials
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
