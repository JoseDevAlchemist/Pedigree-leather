-- Requires the canonical POS migration supabase/migrations/20261118130000_pos_size_inventory.sql.
-- The website owns its order fields and existing belt catalogue support.
begin;

alter table public.products drop constraint products_category_check;
alter table public.products add constraint products_category_check check (category in ('bag','shoe','belt'));
alter table public.products drop constraint if exists products_belt_pos_rollout_check;

alter table public.order_items add column color_id uuid references public.product_colors(id);
alter table public.order_items add column size_id uuid;
alter table public.order_items add column size_system text;
alter table public.order_items add column size_label text;
alter table public.order_items add constraint website_order_size_colour
  foreign key (color_id, size_id) references public.product_color_sizes(color_id, id);
alter table public.order_items add constraint website_order_size_snapshot check (
  (size_id is null and size_system is null and size_label is null)
  or (color_id is not null and size_id is not null and size_system is not null and size_label is not null)
);

alter table public.orders add column website_request_id uuid unique;
alter table public.orders add column website_request_payload jsonb;

-- Old guest insert policies predate the server-side order path.
drop policy if exists "Anyone can create an order" on public.orders;
drop policy if exists "Anyone can create order items" on public.order_items;
revoke insert on public.orders, public.order_items from public, anon, authenticated;

create function public.website_create_order(p_request_id uuid, p_order jsonb, p_items jsonb)
returns table (order_id uuid, order_number text, created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  saved public.orders%rowtype;
  product public.products%rowtype;
  colour public.product_colors%rowtype;
  size_row public.product_color_sizes%rowtype;
  item record;
  stock_after integer;
  order_number_input text := p_order->>'order_number';
  subtotal_value integer := 0;
  subtotal_before_discount integer := 0;
  quoted_subtotal integer := (p_order->>'subtotal')::integer;
  unit_price_value integer;
  delivery_fee_value integer := (p_order->>'delivery_fee')::integer;
  lines jsonb := '[]'::jsonb;
  request_payload jsonb := jsonb_build_array(p_order - 'order_number', p_items);
begin
  if p_request_id is null or quoted_subtotal is null or delivery_fee_value is null
     or delivery_fee_value < 0 or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'website_invalid_order';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('website-order:' || p_request_id::text, 0));
  select * into saved from public.orders o where o.website_request_id = p_request_id;
  if found then
    if saved.website_request_payload is distinct from request_payload then
      raise exception 'website_request_conflict';
    end if;
    return query select saved.id, saved.order_number, false;
    return;
  end if;

  if exists (select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, color_id uuid, quantity integer)
             where i.product_id is null or i.color_id is null or i.quantity is null or i.quantity not between 1 and 10) then
    raise exception 'website_invalid_order';
  end if;

  perform p.id from public.products p
    where p.id in (select i.product_id from jsonb_to_recordset(p_items) as i(product_id uuid))
    order by p.id for update;
  perform c.id from public.product_colors c
    where c.id in (select i.color_id from jsonb_to_recordset(p_items) as i(color_id uuid))
    order by c.id for update;

  for item in
    select i.product_id, i.color_id, i.size_id, sum(i.quantity)::integer as quantity,
           min(i.unit_price) as minimum_quote, max(i.unit_price) as maximum_quote,
           count(i.unit_price) as quoted_lines, count(*) as lines_count
    from jsonb_to_recordset(p_items) as i(product_id uuid, color_id uuid, size_id uuid, quantity integer, unit_price integer)
    group by i.product_id, i.color_id, i.size_id order by i.product_id, i.color_id, i.size_id
  loop
    select * into product from public.products p where p.id = item.product_id and p.active and p.is_website_published;
    if not found then raise exception 'website_variant_unavailable'; end if;
    select * into colour from public.product_colors c where c.id = item.color_id and c.product_id = product.id;
    if not found or (product.stock_tracking_mode = 'size') <> (item.size_id is not null) or item.quantity > 10 then
      raise exception 'website_variant_unavailable';
    end if;

    unit_price_value := round(product.base_price::numeric *
      (100 - case when product.discount_percent between 1 and 99 then product.discount_percent else 0 end) / 100);
    if item.quoted_lines <> item.lines_count or item.minimum_quote <> unit_price_value or item.maximum_quote <> unit_price_value then
      raise exception 'website_price_changed';
    end if;

    stock_after := public.pos_change_variant_stock(product.id, colour.id, item.size_id, -item.quantity, false);
    if stock_after is null then raise exception 'website_variant_unavailable'; end if;
    select * into size_row from public.product_color_sizes s where s.id = item.size_id;
    insert into public.stock_movements (
      product_id, color_id, size_id, size_system, size_label, delta, quantity_after, reason, reference_uuid
    ) values (
      product.id, colour.id, size_row.id, size_row.size_system, size_row.size_label,
      -item.quantity, stock_after, 'website_order', p_request_id
    );

    subtotal_value := subtotal_value + unit_price_value * item.quantity;
    subtotal_before_discount := subtotal_before_discount + product.base_price * item.quantity;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', product.id, 'product_name', product.name, 'product_slug', product.slug,
      'color_id', colour.id, 'color_name', colour.color_name, 'color_hex', colour.color_hex,
      'size_id', size_row.id, 'size_system', size_row.size_system, 'size_label', size_row.size_label,
      'unit_price', unit_price_value, 'quantity', item.quantity, 'line_total', unit_price_value * item.quantity
    ));
  end loop;

  if subtotal_value <> quoted_subtotal then raise exception 'website_price_changed'; end if;
  insert into public.orders (
    order_number, customer_name, customer_email, customer_phone, delivery_method, delivery_address,
    delivery_fee, subtotal, discount_total, total, notes, status, payment_status, zone_id, zone_name,
    website_request_id, website_request_payload
  ) values (
    order_number_input, p_order->>'customer_name', p_order->>'customer_email', p_order->>'customer_phone',
    p_order->>'delivery_method', p_order->>'delivery_address', delivery_fee_value, subtotal_before_discount, subtotal_before_discount - subtotal_value,
    subtotal_value + delivery_fee_value, p_order->>'notes', 'pending_payment', 'pending',
    (p_order->>'zone_id')::uuid, p_order->>'zone_name', p_request_id, request_payload
  ) returning * into saved;

  insert into public.order_items (order_id, product_id, product_name, product_slug, color_id,
    color_name, color_hex, size_id, size_system, size_label, unit_price, quantity, line_total)
  select saved.id, l.* from jsonb_to_recordset(lines) as l(product_id uuid, product_name text,
    product_slug text, color_id uuid, color_name text, color_hex text, size_id uuid, size_system text, size_label text,
    unit_price integer, quantity integer, line_total integer);

  return query select saved.id, saved.order_number, true;
end;
$$;
revoke all on function public.website_create_order(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.website_create_order(uuid, jsonb, jsonb) to service_role;

commit;
