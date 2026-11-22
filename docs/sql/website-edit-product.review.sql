-- Website product editing. Test against a restored Supabase database before applying.
-- This function is called by the website's membership-checked server action.
begin;

create function public.website_edit_product(p_product_id uuid, p_edit jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
set row_security = off
as $$
declare
  current_product public.products%rowtype;
  baseline jsonb;
  image jsonb;
  colour jsonb;
  colour_id uuid;
  colour_order integer;
  image_order integer;
begin
  select * into current_product from public.products
    where id = p_product_id for update;
  if not found then raise exception 'website_product_not_found' using errcode = 'P0002'; end if;

  -- Use the same product → colour lock order as POS catalogue and sale writes.
  perform id from public.product_colors where product_id = p_product_id order by id for update;
  perform image_row.id from public.product_images image_row
    join public.product_colors stored_colour on stored_colour.id = image_row.color_id
    where stored_colour.product_id = p_product_id order by image_row.id for update of image_row;

  select jsonb_build_object(
    'product', jsonb_build_array(
      current_product.name, current_product.slug, current_product.description, current_product.category,
      current_product.category_id, current_product.base_price, current_product.base_price_usd,
      current_product.barcode, current_product.publish_to_pos, current_product.discount_percent,
      current_product.featured, current_product.active, current_product.is_website_published,
      (to_jsonb(current_product)->>'stock_tracking_mode')
    ),
    'colors', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.color_name, 'hex', c.color_hex, 'order', c.sort_order,
      'images', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'angle', i.angle, 'url', i.image_url, 'order', i.sort_order
      ) order by i.id) from public.product_images i where i.color_id = c.id), '[]'::jsonb)
    ) order by c.id) from public.product_colors c where c.product_id = p_product_id), '[]'::jsonb)
  ) into baseline;

  if baseline is distinct from p_edit->'expected' then
    raise exception 'website_edit_stale';
  end if;

  if jsonb_typeof(p_edit->'colors') is distinct from 'array'
      or jsonb_array_length(p_edit->'colors') = 0 then
    raise exception 'website_invalid_colour' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_edit->'colors') entry
    where entry->>'id' is not null and not exists (
      select 1 from public.product_colors c
      where c.product_id = p_product_id and c.id = (entry->>'id')::uuid
    )
  ) then
    raise exception 'website_invalid_colour' using errcode = '22023';
  end if;

  -- Retain every saved colour. This also preserves documents whose colour IDs
  -- exist only in JSON, without taking table locks or relying on every writer
  -- sharing a removal protocol. New website colours start at zero stock.
  if exists (
    select 1 from public.product_colors c where c.product_id = p_product_id
    and not exists (select 1 from jsonb_array_elements(p_edit->'colors') entry
      where (entry->>'id')::uuid = c.id)
  ) then
    raise exception 'website_colour_removal_disabled';
  end if;

  if (to_jsonb(current_product)->>'stock_tracking_mode') = 'size' and p_edit->>'category' is distinct from 'shoe' then
    raise exception 'website_sized_product_requires_shoe_category' using errcode = '23514';
  end if;

  -- A concurrent publication change makes the baseline stale. Older forms
  -- which omit the website flag keep its current value.
  update public.products set
    name = p_edit->>'name',
    slug = p_edit->>'slug',
    description = p_edit->>'description',
    category = p_edit->>'category',
    category_id = (p_edit->>'categoryId')::uuid,
    base_price = (p_edit->>'basePrice')::integer,
    base_price_usd = (p_edit->>'basePriceUsd')::integer,
    barcode = p_edit->>'barcode',
    publish_to_pos = (p_edit->>'publishToPos')::boolean,
    discount_percent = (p_edit->>'discountPercent')::integer,
    featured = (p_edit->>'featured')::boolean,
    active = (p_edit->>'active')::boolean,
    is_website_published = coalesce((p_edit->>'isWebsitePublished')::boolean, current_product.is_website_published)
  where id = p_product_id
    and baseline->'product' is distinct from jsonb_build_array(
      p_edit->>'name', p_edit->>'slug', p_edit->>'description', p_edit->>'category',
      (p_edit->>'categoryId')::uuid, (p_edit->>'basePrice')::integer,
      (p_edit->>'basePriceUsd')::integer, p_edit->>'barcode',
      (p_edit->>'publishToPos')::boolean, (p_edit->>'discountPercent')::integer,
      (p_edit->>'featured')::boolean, (p_edit->>'active')::boolean,
      coalesce((p_edit->>'isWebsitePublished')::boolean, current_product.is_website_published),
      (to_jsonb(current_product)->>'stock_tracking_mode')
    );

  for colour, colour_order in
    select value, (ordinality - 1)::integer
      from jsonb_array_elements(p_edit->'colors') with ordinality
  loop
    colour_id := (colour->>'id')::uuid;
    if colour_id is null then
      insert into public.product_colors(product_id, color_name, color_hex, sort_order, stock_quantity)
      values (p_product_id, colour->>'name', colour->>'hex', colour_order, 0)
      returning id into colour_id;
    else
      update public.product_colors set
        color_name = colour->>'name', color_hex = colour->>'hex', sort_order = colour_order
      where id = colour_id and product_id = p_product_id
        and (color_name, color_hex, sort_order)
          is distinct from (colour->>'name', colour->>'hex', colour_order);
    end if;

    begin
      if jsonb_typeof(colour->'images') is distinct from 'array' then
        raise exception 'invalid_image_array' using errcode = '22023';
      end if;
      for image, image_order in
        select value, (ordinality - 1)::integer
          from jsonb_array_elements(colour->'images') with ordinality
      loop
        insert into public.product_images as stored(color_id, angle, image_url, sort_order)
        values (colour_id, image->>'angle', image->>'url', image_order)
        on conflict (color_id, angle) do update set
          image_url = excluded.image_url, sort_order = excluded.sort_order
          where (stored.image_url, stored.sort_order)
            is distinct from (excluded.image_url, excluded.sort_order);
      end loop;

      delete from public.product_images i where i.color_id = colour_id
        and i.image_url is not null
        and not exists (select 1 from jsonb_array_elements(colour->'images') entry
          where entry->>'angle' = i.angle);
    exception when integrity_constraint_violation or data_exception then
      raise exception 'website_image_association_failed' using detail = sqlstate || ': ' || sqlerrm;
    end;
  end loop;

  return p_product_id;
end;
$$;

-- Scope only this new function. Existing policies and grants are untouched.
revoke all on function public.website_edit_product(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.website_edit_product(uuid, jsonb) to service_role;

commit;
