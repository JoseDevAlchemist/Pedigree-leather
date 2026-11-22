-- Run only in a fresh, disposable PostgreSQL database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.products (
  id uuid primary key, name text not null, slug text not null unique, description text not null,
  category text not null, category_id uuid, base_price integer not null, base_price_usd integer,
  barcode text, publish_to_pos boolean not null, discount_percent integer not null,
  featured boolean not null, active boolean not null, is_website_published boolean not null,
  stock_quantity integer not null, stock_tracking_mode text not null default 'color'
);
create table public.product_colors (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products,
  color_name text not null, color_hex text not null, sort_order integer not null,
  stock_quantity integer not null check (stock_quantity >= 0), unique(product_id, color_name)
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), color_id uuid not null references public.product_colors on delete cascade,
  angle text not null check (angle in ('front', 'back', 'top', 'side-left')), image_url text,
  sort_order integer not null, unique(color_id, angle)
);
create table public.pos_sale_items (color_id uuid references public.product_colors);
create table public.pos_return_items (color_id uuid references public.product_colors on delete restrict);
create table public.stock_movements (color_id uuid references public.product_colors on delete set null);
create table public.pos_quotations (request_items jsonb);
create table public.pos_card_payments (items jsonb);
create table public.pos_mpesa_sales (items jsonb);
create schema storage;
create table storage.objects (name text primary key);
insert into storage.objects values ('tan-front.webp'), ('tan-back.webp');
grant usage on schema storage to service_role;
grant select on storage.objects to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
insert into public.products values
  ('00000000-0000-4000-8000-000000000001', 'Bag', 'bag', 'Leather', 'bag', null, 400, null, 'B-1', true, 0, false, true, false, 4);
insert into public.product_colors values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Tan', '#884422', 0, 4),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Black', '#000000', 1, 0),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Blue', '#0000FF', 2, 0),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'Red', '#FF0000', 3, 0),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', 'White', '#FFFFFF', 4, 0);
insert into public.pos_sale_items values ('00000000-0000-4000-8000-000000000011');
insert into public.pos_return_items values ('00000000-0000-4000-8000-000000000011');
insert into public.stock_movements values ('00000000-0000-4000-8000-000000000012');
insert into public.pos_quotations values ('[{"color_id":"00000000-0000-4000-8000-000000000013"}]');
insert into public.pos_card_payments values ('[{"color_id":"00000000-0000-4000-8000-000000000014"}]');
insert into public.pos_mpesa_sales values ('[{"color_id":"00000000-0000-4000-8000-000000000014"}]');
insert into public.product_images values
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000010',
    'front', 'https://fixture.supabase.co/storage/v1/object/public/product-images/tan-front.webp', 0),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000010',
    'back', 'https://fixture.supabase.co/storage/v1/object/public/product-images/tan-back.webp', 3);
\ir ../docs/sql/website-edit-product.review.sql

set role service_role;
do $$
declare
  product_id constant uuid := '00000000-0000-4000-8000-000000000001';
  tan constant uuid := '00000000-0000-4000-8000-000000000010';
  black constant uuid := '00000000-0000-4000-8000-000000000011';
  front constant uuid := '00000000-0000-4000-8000-000000000020';
  back constant uuid := '00000000-0000-4000-8000-000000000021';
  base_url constant text := 'https://fixture.supabase.co/storage/v1/object/public/product-images/';
  expected jsonb := jsonb_build_object(
    'product', '["Bag","bag","Leather","bag",null,400,null,"B-1",true,0,false,true,false,"color"]'::jsonb,
    'colors', jsonb_build_array(
      jsonb_build_object('id',tan,'name','Tan','hex','#884422','order',0,'images',jsonb_build_array(
        jsonb_build_object('id',front,'angle','front','url',base_url||'tan-front.webp','order',0),
        jsonb_build_object('id',back,'angle','back','url',base_url||'tan-back.webp','order',3)
      )),
      '{"id":"00000000-0000-4000-8000-000000000011","name":"Black","hex":"#000000","order":1,"images":[]}'::jsonb,
      '{"id":"00000000-0000-4000-8000-000000000012","name":"Blue","hex":"#0000FF","order":2,"images":[]}'::jsonb,
      '{"id":"00000000-0000-4000-8000-000000000013","name":"Red","hex":"#FF0000","order":3,"images":[]}'::jsonb,
      '{"id":"00000000-0000-4000-8000-000000000014","name":"White","hex":"#FFFFFF","order":4,"images":[]}'::jsonb
    )
  );
  draft jsonb := '{
    "name":"Bag edited","slug":"bag","description":"Leather","category":"bag","categoryId":null,"basePrice":400,
    "barcode":"B-1","publishToPos":true,"discountPercent":0,"featured":false,"active":true,
    "colors":[
      {"id":"00000000-0000-4000-8000-000000000010","name":"Tan","hex":"#884422","images":[]},
      {"id":"00000000-0000-4000-8000-000000000011","name":"Jet black","hex":"#000000","images":[]},
      {"id":"00000000-0000-4000-8000-000000000012","name":"Blue","hex":"#0000FF","images":[]},
      {"id":"00000000-0000-4000-8000-000000000013","name":"Red","hex":"#FF0000","images":[]},
      {"id":"00000000-0000-4000-8000-000000000014","name":"White","hex":"#FFFFFF","images":[]}
    ]
  }'::jsonb;
  omission integer;
begin
  -- The previous edit strategy deleted every colour. Reproduce its failure
  -- against the fixture's real historical foreign keys.
  begin
    delete from public.product_colors where product_colors.product_id = '00000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'Test failed: old blanket delete succeeded';
  exception when foreign_key_violation then
    assert sqlstate = '23503';
  end;

  draft := draft || jsonb_build_object('expected',expected);
  draft := jsonb_set(draft, '{colors,0,images}', jsonb_build_array(
    jsonb_build_object('angle','front','url',base_url||'new-front.webp?v=2'),
    jsonb_build_object('angle','back','url',base_url||'tan-back.webp')
  ));

  for omission in 0..4 loop
    begin
      perform public.website_edit_product(product_id, draft #- array['colors',omission::text]);
      raise exception 'Test failed: protected colour removal succeeded';
    exception when raise_exception then
      if sqlerrm <> 'website_colour_removal_disabled' then raise; end if;
    end;
  end loop;

  begin
    perform public.website_edit_product(product_id, jsonb_set(draft,'{colors,0,images,1,angle}','"unsupported"'));
    raise exception 'Test failed: invalid image saved';
  exception when raise_exception then
    if sqlerrm <> 'website_image_association_failed' then raise; end if;
  end;
  assert (select name from public.products where id=product_id) = 'Bag';
  assert (select image_url from public.product_images where id=front) = base_url||'tan-front.webp';
  assert (select image_url from public.product_images where id=back) = base_url||'tan-back.webp';
  assert (select array_agg(name order by name) from storage.objects) = array['tan-back.webp','tan-front.webp'];


  update public.products set is_website_published=true where id=product_id;
  begin
    perform public.website_edit_product(product_id,draft);
    raise exception 'Test failed: stale publication edit saved';
  exception when raise_exception then
    if sqlerrm <> 'website_edit_stale' then raise; end if;
  end;
  update public.products set is_website_published=false where id=product_id;

  -- The baseline predates this stock adjustment. Stock changes must never make
  -- an otherwise current catalogue edit stale.
  update public.product_colors set stock_quantity=3 where id=tan;
  update public.products set stock_quantity=3 where id=product_id;
  assert public.website_edit_product(product_id,draft) = product_id;
  assert not exists (
    select 1 from pg_locks where pid=pg_backend_pid() and locktype='relation' and relation in (
      'public.pos_mpesa_sales'::regclass, 'public.pos_card_payments'::regclass, 'public.pos_quotations'::regclass
    )
  );
  assert (select count(*) from public.product_colors) = 5;
  assert (select color_name from public.product_colors where id=black) = 'Jet black';
  assert exists (select 1 from public.pos_sale_items where color_id=black);
  assert exists (select 1 from public.pos_return_items where color_id=black);
  assert (select sum(stock_quantity) from public.product_colors) = 3;
  assert (select stock_quantity=3 and publish_to_pos and not is_website_published from public.products where id=product_id);
  assert (select image_url from public.product_images where id=front) = base_url||'new-front.webp?v=2';
  assert (select image_url=base_url||'tan-back.webp' and sort_order=1 from public.product_images where id=back);

  begin
    perform public.website_edit_product(product_id,draft);
    raise exception 'Test failed: stale edit saved';
  exception when raise_exception then
    if sqlerrm <> 'website_edit_stale' then raise; end if;
  end;

  expected := jsonb_set(expected,'{product,0}','"Bag edited"');
  expected := jsonb_set(expected,'{colors,0,images,0,url}',to_jsonb(base_url||'new-front.webp?v=2'));
  expected := jsonb_set(expected,'{colors,0,images,1,order}','1');
  expected := jsonb_set(expected,'{colors,1,name}','"Jet black"');
  draft := jsonb_set(draft,'{expected}',expected);
  draft := jsonb_set(draft,'{colors,0,images}',jsonb_build_array(
    jsonb_build_object('angle','top','url',base_url||'new-top.webp'),
    jsonb_build_object('angle','front','url',base_url||'second-front.webp'),
    jsonb_build_object('angle','side-left','url',base_url||'new-side.webp')
  ));
  draft := jsonb_set(draft, '{colors}',
    (draft->'colors') || '[{"name":"Green","hex":"#00AA00","images":[]}]'::jsonb);
  assert public.website_edit_product(product_id,draft) = product_id;
  assert not exists (select 1 from public.product_images where id=back);
  assert (select image_url=base_url||'second-front.webp' and sort_order=1 from public.product_images where id=front);
  assert (select sort_order=0 from public.product_images where color_id=tan and angle='top');
  assert (select count(*) from public.product_images where color_id=tan and angle in ('top','side-left')) = 2;
  assert exists (select 1 from public.product_colors where color_name='Green' and stock_quantity=0);
  assert exists (select 1 from public.product_colors where color_name='White');
  assert exists (select 1 from public.stock_movements where color_id='00000000-0000-4000-8000-000000000012');
  assert exists (select 1 from public.pos_quotations
    where request_items @> '[{"color_id":"00000000-0000-4000-8000-000000000013"}]');

  raise notice 'Website edit fixture assertions passed';
end;
$$;
reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.website_edit_product(uuid,jsonb)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.website_edit_product(uuid,jsonb)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.website_edit_product(uuid,jsonb)', 'EXECUTE');
end;
$$;

select 'Website edit fixture assertions passed' as result;
