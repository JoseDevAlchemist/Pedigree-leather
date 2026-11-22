\set ON_ERROR_STOP on
-- Run against a fresh, disposable PostgreSQL database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt()->>'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO PUBLIC;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean, file_size_limit int, allowed_mime_types text[]
);
CREATE TABLE public.admin_users (email text PRIMARY KEY, role text NOT NULL);
INSERT INTO public.admin_users VALUES ('owner@fixture.test', 'owner'), ('worker@fixture.test', 'worker');
CREATE TABLE public.orders (id uuid PRIMARY KEY);

\ir ../supabase/migrations/008_shop_settings.sql
\ir ../supabase/migrations/009_delivery_zones.sql
\ir ../supabase/migrations/011_shop_settings_socials.sql
\ir ../supabase/migrations/023_legal_pages.sql
ALTER TABLE public.shop_settings ADD COLUMN exchange_rate_kes_to_usd numeric NOT NULL DEFAULT 130;
GRANT SELECT ON public.shop_settings, public.delivery_zones TO anon, authenticated;
GRANT SELECT, UPDATE ON public.shop_settings, public.legal_pages TO service_role;
GRANT SELECT ON public.admin_users TO service_role;
GRANT INSERT, UPDATE ON public.delivery_zones TO authenticated;
\ir ../supabase/migrations/026_admin_settings.sql

SET ROLE service_role;
DO $$
DECLARE
  before_version timestamptz;
  after_version timestamptz;
  snapshot jsonb;
BEGIN
  snapshot := public.read_website_settings('owner@fixture.test', 'orders');
  before_version := (snapshot->'shop'->>'updated_at')::timestamptz;
  IF snapshot->'policies'->>'returns' IS NULL THEN
    RAISE EXCEPTION 'Missing returns baseline';
  END IF;
  IF public.read_website_settings('worker@fixture.test', 'store') IS NOT NULL THEN
    RAISE EXCEPTION 'Worker could read the settings snapshot';
  END IF;
  BEGIN
    PERFORM public.save_website_settings('worker@fixture.test', before_version, '{}', '{}', '{}', '{}');
    RAISE EXCEPTION 'Worker write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  after_version := public.save_website_settings('owner@fixture.test', before_version,
    '{"exchange_rate_kes_to_usd":145.25}', '{}', '{"low_stock_threshold":4}', '{"returns":"Fixture returns policy"}');
  IF after_version <= before_version THEN RAISE EXCEPTION 'Version did not advance'; END IF;
  IF (SELECT exchange_rate_updated_at FROM public.shop_settings) <> after_version THEN RAISE EXCEPTION 'Rate timestamp not updated'; END IF;
  IF (SELECT exchange_rate_kes_to_usd FROM public.shop_settings) <> 145.25 THEN RAISE EXCEPTION 'Rate was not written'; END IF;
  IF (SELECT content FROM public.legal_pages WHERE slug = 'returns') <> 'Fixture returns policy' THEN RAISE EXCEPTION 'Policy was not written'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_settings_audit WHERE actor = 'owner@fixture.test' AND changes ? 'exchange_rate_kes_to_usd') THEN
    RAISE EXCEPTION 'Missing currency audit';
  END IF;

  BEGIN
    PERFORM public.save_website_settings('owner@fixture.test', before_version, '{"shop_name":"Stale"}', '{}', '{}', '{}');
    RAISE EXCEPTION 'Stale write unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM public.save_website_settings('owner@fixture.test', after_version,
      '{"pickup_available":false}', '{"delivery_enabled":false}', '{}', '{}');
    RAISE EXCEPTION 'Both fulfilment methods were disabled';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"email":"worker@fixture.test"}', false);
DO $$
BEGIN
  IF has_table_privilege(current_user, 'public.website_admin_preferences', 'SELECT') THEN
    RAISE EXCEPTION 'Private preferences are readable by workers';
  END IF;
  IF has_function_privilege(current_user, 'public.save_website_settings(text,timestamptz,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Settings RPC is callable by browser roles';
  END IF;
  UPDATE public.delivery_zones SET fee = 900;
  IF FOUND THEN RAISE EXCEPTION 'Worker changed a delivery fee'; END IF;
END;
$$;
SELECT set_config('request.jwt.claims', '{"email":"owner@fixture.test"}', false);
UPDATE public.delivery_zones SET fee = 375 WHERE name = 'Nairobi CBD';
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_settings_audit WHERE actor = 'owner@fixture.test' AND changes ? 'delivery_zone') THEN
    RAISE EXCEPTION 'Missing delivery-zone audit';
  END IF;
END;
$$;
