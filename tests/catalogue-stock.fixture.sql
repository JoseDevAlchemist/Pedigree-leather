-- Isolated Supabase primitives required by the POS migration chain.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
grant usage on schema auth, extensions to public;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets,
  name text, unique(bucket_id, name)
);
alter default privileges in schema public grant all on tables to service_role;

-- Website-specific fixture after the canonical POS migration chain.
alter table public.products add column category_id uuid;
create table categories (
  id uuid primary key, is_active boolean not null, slug text, name text,
  parent_id uuid references categories(id)
);
insert into categories (id, is_active) values ('10000000-0000-4000-8000-000000000001', true);

create table orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  customer_name text not null, customer_email text, customer_phone text not null,
  delivery_method text not null, delivery_address text, delivery_fee integer not null,
  subtotal integer not null, discount_total integer not null, total integer not null,
  notes text, status text not null, payment_status text not null, zone_id uuid, zone_name text,
  payment_reference text
);
create table order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders,
  product_id uuid not null references products, product_name text not null, product_slug text not null,
  color_name text not null, color_hex text not null,
  unit_price integer not null, quantity integer not null, line_total integer not null
);


create table order_status_history (
  order_id uuid not null references orders, from_status text, to_status text not null,
  changed_by_email text, note text
);
