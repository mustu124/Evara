-- Evara Studios — GST, per-candle selections in sets, sale badge.
-- Run after 0001 and 0002. Safe to run once; existing orders are kept.

-- ───────────────────────── catalog ─────────────────────────

alter table public.products
  add column on_sale boolean not null default false,
  -- GST % included in this product's prices. NULL means "use the store default"
  -- (Admin -> Settings), so the rate is never hardcoded per product.
  add column gst_rate numeric(5, 2) check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 40));

-- ───────────────────────── orders ─────────────────────────

alter table public.orders
  add column customer_gstin text
    check (customer_gstin is null or customer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  add column seller_state text,
  -- NULL on orders placed before GST was recorded.
  add column tax_type text check (tax_type is null or tax_type in ('intra_state', 'inter_state')),
  add column taxable_value numeric(12, 2) not null default 0 check (taxable_value >= 0),
  add column cgst_amount numeric(12, 2) not null default 0 check (cgst_amount >= 0),
  add column sgst_amount numeric(12, 2) not null default 0 check (sgst_amount >= 0),
  add column igst_amount numeric(12, 2) not null default 0 check (igst_amount >= 0),
  add column shipping_gst_rate numeric(5, 2) not null default 0,
  add column shipping_taxable_value numeric(12, 2) not null default 0;

alter table public.order_items
  add column gst_rate numeric(5, 2) not null default 0,
  add column taxable_value numeric(12, 2) not null default 0,
  add column tax_amount numeric(12, 2) not null default 0;

-- selected_options now carries one entry per candle and option:
--   [{ "unit": 1, "name": "Hue", "value": "Blush Pink" }, { "unit": 2, ... }]
-- Older rows have no "unit" and are read as a single candle.

-- ───────────────────────── GST maths ─────────────────────────
-- Prices are GST-inclusive, so tax is extracted from the amount, never added.
-- The parts always add back up to the amount exactly:
--   intra-state: CGST = SGST = round(tax / 2), taxable = amount - CGST - SGST
--   inter-state: IGST = round(tax),            taxable = amount - IGST

create or replace function public.gst_split(p_amount numeric, p_rate numeric, p_intra boolean)
returns table (taxable numeric, cgst numeric, sgst numeric, igst numeric)
language sql
immutable
set search_path = ''
as $$
  with t as (select p_amount - p_amount / (1 + p_rate / 100) as tax)
  select
    p_amount - case when p_intra then 2 * round(tax / 2, 2) else round(tax, 2) end,
    case when p_intra then round(tax / 2, 2) else 0::numeric end,
    case when p_intra then round(tax / 2, 2) else 0::numeric end,
    case when p_intra then 0::numeric else round(tax, 2) end
  from t;
$$;

-- ───────────────────────── order creation ─────────────────────────
-- Each cart line now sends "units": one list of option-value ids per candle in
-- the pack, e.g. a Set of 2 sends two lists. Everything is still validated and
-- priced here; the caller supplies only ids, quantities and customer details.

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
  v_units jsonb;
  v_value_ids uuid[];
  v_all_value_ids uuid[];
  v_qty integer;
  v_row record;
  v_tax record;
  v_unit integer;
  v_option_count integer;
  v_selected_count integer;
  v_selected_options_distinct integer;
  v_bad_value text;
  v_unit_selected jsonb;
  v_selected jsonb;
  v_line_error jsonb;
  v_image text;
  v_errors jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_needed jsonb := '{}'::jsonb;
  v_need integer;
  v_line_total numeric(12, 2);
  v_rate numeric(5, 2);
  v_default_rate numeric(5, 2) := 5;
  v_max_rate numeric(5, 2) := 0;
  v_subtotal numeric(12, 2) := 0;
  v_shipping numeric(12, 2) := 0;
  v_shipping_taxable numeric(12, 2) := 0;
  v_taxable numeric(12, 2) := 0;
  v_cgst numeric(12, 2) := 0;
  v_sgst numeric(12, 2) := 0;
  v_igst numeric(12, 2) := 0;
  v_store jsonb;
  v_seller_state text := 'Maharashtra';
  v_intra boolean;
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

  -- Store settings: seller state, default GST rate and the shipping charge.
  select value into v_store from public.site_settings where key = 'store';
  begin
    v_seller_state := coalesce(nullif(btrim(v_store ->> 'seller_state'), ''), 'Maharashtra');
    v_default_rate := coalesce((v_store ->> 'default_gst_rate')::numeric, 5);
    if v_default_rate < 0 or v_default_rate > 40 then v_default_rate := 5; end if;
  exception when others then
    v_default_rate := 5;
  end;
  -- Same state as the seller: CGST + SGST. Any other state: IGST.
  v_intra := lower(btrim(coalesce(p_customer ->> 'state', ''))) = lower(v_seller_state);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;

    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_qty := (v_item ->> 'quantity')::integer;
      v_units := v_item -> 'units';
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
           p.track_inventory, p.stock_quantity, p.gst_rate,
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

    -- One set of choices per candle in the pack.
    if v_units is null or jsonb_typeof(v_units) <> 'array'
       or jsonb_array_length(v_units) <> v_row.pack_quantity then
      v_errors := v_errors || jsonb_build_object('index', v_idx, 'code', 'invalid_options',
        'message', 'Please choose the options for each candle in ' || v_row.name || ' (' || v_row.label || ').');
      continue;
    end if;

    select count(*) into v_option_count
      from public.product_options o where o.product_id = v_row.product_id;

    v_selected := '[]'::jsonb;
    v_all_value_ids := '{}';
    v_line_error := null;

    for v_unit in 1 .. v_row.pack_quantity loop
      begin
        select coalesce(array_agg(distinct e::uuid), '{}') into v_value_ids
          from jsonb_array_elements_text(v_units -> (v_unit - 1)) as e;
      exception when others then
        v_line_error := jsonb_build_object('index', v_idx, 'code', 'invalid',
          'message', 'This item could not be read. Please remove it and add it again.');
        exit;
      end;

      -- Exactly one available value for every option of the product.
      select count(*), count(distinct o.id),
             min(ov.value) filter (where ov.is_coming_soon or not ov.is_available),
             coalesce(jsonb_agg(jsonb_build_object('unit', v_unit, 'name', o.name, 'value', ov.value)
                                order by o.sort_order, o.name), '[]'::jsonb)
        into v_selected_count, v_selected_options_distinct, v_bad_value, v_unit_selected
        from public.product_option_values ov
        join public.product_options o on o.id = ov.option_id
       where ov.id = any (v_value_ids) and o.product_id = v_row.product_id;

      if v_selected_count <> coalesce(array_length(v_value_ids, 1), 0)
         or v_selected_count <> v_option_count
         or v_selected_options_distinct <> v_option_count then
        v_line_error := jsonb_build_object('index', v_idx, 'code', 'invalid_options',
          'message', 'Please re-select the options for '
            || case when v_row.pack_quantity > 1 then 'candle ' || v_unit || ' of ' else '' end
            || v_row.name || '.');
        exit;
      end if;

      if v_bad_value is not null then
        v_line_error := jsonb_build_object('index', v_idx, 'code', 'unavailable',
          'message', v_row.name || ': "' || v_bad_value || '" is not available to order yet.');
        exit;
      end if;

      v_selected := v_selected || v_unit_selected;
      v_all_value_ids := v_all_value_ids || v_value_ids;
    end loop;

    if v_line_error is not null then
      v_errors := v_errors || v_line_error;
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
     order by (i.option_value_id = any (v_all_value_ids)) desc nulls last, i.sort_order, i.created_at
     limit 1;

    v_line_total := v_row.price * v_qty;
    v_rate := coalesce(v_row.gst_rate, v_default_rate);
    v_max_rate := greatest(v_max_rate, v_rate);
    select * into v_tax from public.gst_split(v_line_total, v_rate, v_intra);

    v_subtotal := v_subtotal + v_line_total;
    v_taxable := v_taxable + v_tax.taxable;
    v_cgst := v_cgst + v_tax.cgst;
    v_sgst := v_sgst + v_tax.sgst;
    v_igst := v_igst + v_tax.igst;

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
      'line_total', v_line_total,
      'gst_rate', v_rate,
      'taxable_value', v_tax.taxable,
      'tax_amount', v_tax.cgst + v_tax.sgst + v_tax.igst,
      'image_path', v_image);
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items',
      'message', 'Some items in your cart need attention.', 'errors', v_errors);
  end if;

  -- Shipping: one flat, GST-inclusive charge per order, set by the administrator.
  -- As part of the same supply it is taxed at the highest rate among the items.
  begin
    v_shipping := greatest(coalesce((v_store ->> 'shipping_fee')::numeric, 0), 0);
    if v_store ->> 'free_shipping_above' is not null
       and v_subtotal >= (v_store ->> 'free_shipping_above')::numeric then
      v_shipping := 0;
    end if;
  exception when others then
    v_shipping := 0;
  end;

  if v_shipping > 0 then
    select * into v_tax from public.gst_split(v_shipping, v_max_rate, v_intra);
    v_shipping_taxable := v_tax.taxable;
    v_taxable := v_taxable + v_tax.taxable;
    v_cgst := v_cgst + v_tax.cgst;
    v_sgst := v_sgst + v_tax.sgst;
    v_igst := v_igst + v_tax.igst;
  end if;

  loop
    select 'EV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' ||
           string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
      into v_reference
      from generate_series(1, 5);
    exit when not exists (select 1 from public.orders where reference = v_reference);
  end loop;

  insert into public.orders (
    reference, customer_name, customer_phone, customer_email, customer_gstin,
    address_line1, address_line2, city, state, pincode, customer_note,
    subtotal, shipping_amount, total, client_hash,
    seller_state, tax_type, taxable_value, cgst_amount, sgst_amount, igst_amount,
    shipping_gst_rate, shipping_taxable_value)
  values (
    v_reference,
    btrim(p_customer ->> 'name'),
    v_phone,
    nullif(btrim(coalesce(p_customer ->> 'email', '')), ''),
    nullif(upper(btrim(coalesce(p_customer ->> 'gstin', ''))), ''),
    btrim(p_customer ->> 'address_line1'),
    nullif(btrim(coalesce(p_customer ->> 'address_line2', '')), ''),
    btrim(p_customer ->> 'city'),
    btrim(p_customer ->> 'state'),
    p_customer ->> 'pincode',
    nullif(btrim(coalesce(p_customer ->> 'note', '')), ''),
    v_subtotal, v_shipping, v_subtotal + v_shipping, p_client_hash,
    v_seller_state, case when v_intra then 'intra_state' else 'inter_state' end,
    v_taxable, v_cgst, v_sgst, v_igst,
    case when v_shipping > 0 then v_max_rate else 0 end, v_shipping_taxable)
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_label, pack_quantity,
    selected_options, unit_price, compare_at_price, quantity, line_total, image_path,
    gst_rate, taxable_value, tax_amount)
  select v_order.id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
         l ->> 'product_name', l ->> 'variant_label', (l ->> 'pack_quantity')::integer,
         l -> 'selected_options', (l ->> 'unit_price')::numeric,
         (l ->> 'compare_at_price')::numeric, (l ->> 'quantity')::integer,
         (l ->> 'line_total')::numeric, l ->> 'image_path',
         (l ->> 'gst_rate')::numeric, (l ->> 'taxable_value')::numeric, (l ->> 'tax_amount')::numeric
    from jsonb_array_elements(v_lines) as l;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'id', v_order.id,
    'reference', v_order.reference,
    'subtotal', v_order.subtotal,
    'shipping_amount', v_order.shipping_amount,
    'total', v_order.total,
    'seller_state', v_order.seller_state,
    'tax_type', v_order.tax_type,
    'taxable_value', v_order.taxable_value,
    'cgst_amount', v_order.cgst_amount,
    'sgst_amount', v_order.sgst_amount,
    'igst_amount', v_order.igst_amount,
    'shipping_gst_rate', v_order.shipping_gst_rate,
    'customer_gstin', v_order.customer_gstin,
    'items', v_lines));
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text) to service_role;
