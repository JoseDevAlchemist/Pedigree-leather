BEGIN;

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS storefront_preferences jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(storefront_preferences) = 'object'),
  ADD COLUMN IF NOT EXISTS exchange_rate_updated_at timestamptz;

DROP POLICY IF EXISTS "Admins update shop_settings" ON public.shop_settings;
REVOKE INSERT, UPDATE, DELETE ON public.shop_settings FROM PUBLIC, anon, authenticated;

CREATE TABLE public.shop_settings_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor text NOT NULL,
  changes jsonb NOT NULL
);

ALTER TABLE public.shop_settings_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_settings_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.shop_settings_audit TO service_role;
GRANT USAGE ON SEQUENCE public.shop_settings_audit_id_seq TO service_role;

CREATE TABLE public.website_admin_preferences (
  id text PRIMARY KEY CHECK (id = 'default'),
  preferences jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(preferences) = 'object')
);

INSERT INTO public.website_admin_preferences (id) VALUES ('default');
ALTER TABLE public.website_admin_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_admin_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.website_admin_preferences TO service_role;

CREATE FUNCTION public.capture_shop_settings_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  diff jsonb;
BEGIN
  SELECT jsonb_object_agg(key, jsonb_build_object('from', to_jsonb(OLD)->key, 'to', value))
    INTO diff
    FROM jsonb_each(to_jsonb(NEW) - ARRAY['updated_at', 'exchange_rate_updated_at'])
    WHERE value IS DISTINCT FROM to_jsonb(OLD)->key;
  IF diff IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.updated_at := clock_timestamp();
  IF NEW.exchange_rate_kes_to_usd IS DISTINCT FROM OLD.exchange_rate_kes_to_usd THEN
    NEW.exchange_rate_updated_at := NEW.updated_at;
  END IF;
  INSERT INTO public.shop_settings_audit(actor, changes)
    VALUES (coalesce(nullif(current_setting('pedigree.settings_actor', true), ''),
                     auth.uid()::text, 'database'), diff);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_shop_settings_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_shop_settings_change BEFORE UPDATE ON public.shop_settings
  FOR EACH ROW EXECUTE FUNCTION public.capture_shop_settings_change();

DROP POLICY IF EXISTS "Authenticated full access legal pages" ON public.legal_pages;
REVOKE INSERT, UPDATE, DELETE ON public.legal_pages FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.read_website_settings(p_actor text, p_section text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'shop', to_jsonb(shop),
    'private', CASE WHEN p_section IN ('inventory', 'notifications') THEN
      (SELECT preferences FROM public.website_admin_preferences WHERE id = 'default') END,
    'policies', CASE WHEN p_section = 'orders' THEN
      (SELECT jsonb_object_agg(slug, content) FROM public.legal_pages WHERE slug IN ('terms', 'returns')) END
  )
  FROM public.shop_settings AS shop
  WHERE shop.id = 'default' AND EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = p_actor AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.read_website_settings(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_website_settings(text, text) TO service_role;

CREATE FUNCTION public.save_website_settings(
  p_actor text, p_version timestamptz, p_core jsonb, p_preferences jsonb, p_private jsonb, p_policies jsonb
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  existing public.shop_settings;
  proposed public.shop_settings;
  version timestamptz;
  prior_private jsonb;
  next_private jsonb;
  policy record;
  prior_content text;
  private_or_policy_change boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE email = p_actor AND role = 'owner') THEN
    RAISE EXCEPTION 'settings_owner_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO STRICT existing FROM public.shop_settings WHERE id = 'default' FOR UPDATE;
  IF existing.updated_at IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'settings_stale' USING ERRCODE = '40001';
  END IF;

  proposed := jsonb_populate_record(existing, p_core);
  IF NOT (proposed.exchange_rate_kes_to_usd > 0 AND proposed.exchange_rate_kes_to_usd <= 100000)
     AND proposed.exchange_rate_kes_to_usd IS DISTINCT FROM existing.exchange_rate_kes_to_usd THEN
    RAISE EXCEPTION 'invalid_exchange_rate' USING ERRCODE = '22023';
  END IF;
  IF NOT proposed.pickup_available AND
     NOT coalesce(((existing.storefront_preferences || p_preferences) ->> 'delivery_enabled')::boolean, true) THEN
    RAISE EXCEPTION 'settings_fulfilment_required' USING ERRCODE = '22023';
  END IF;

  SELECT preferences INTO STRICT prior_private FROM public.website_admin_preferences WHERE id = 'default';
  next_private := prior_private || p_private;
  IF prior_private IS DISTINCT FROM next_private THEN
    private_or_policy_change := true;
    UPDATE public.website_admin_preferences SET preferences = next_private WHERE id = 'default';
    INSERT INTO public.shop_settings_audit(actor, changes) VALUES (
      p_actor, jsonb_build_object('admin_preferences', jsonb_build_object('from', prior_private, 'to', next_private))
    );
  END IF;

  FOR policy IN SELECT key, value FROM jsonb_each_text(p_policies) LOOP
    IF policy.key NOT IN ('terms', 'returns') OR coalesce(length(policy.value), 0) NOT BETWEEN 1 AND 20000 THEN
      RAISE EXCEPTION 'invalid_legal_policy' USING ERRCODE = '22023';
    END IF;
    SELECT content INTO STRICT prior_content FROM public.legal_pages WHERE slug = policy.key FOR UPDATE;
    IF prior_content IS DISTINCT FROM policy.value THEN
      UPDATE public.legal_pages SET content = policy.value, updated_at = clock_timestamp() WHERE slug = policy.key;
      INSERT INTO public.shop_settings_audit(actor, changes) VALUES (
        p_actor, jsonb_build_object(policy.key, jsonb_build_object('from', prior_content, 'to', policy.value))
      );
      private_or_policy_change := true;
    END IF;
  END LOOP;

  PERFORM set_config('pedigree.settings_actor', p_actor, true);
  UPDATE public.shop_settings SET
    updated_at = CASE WHEN private_or_policy_change THEN clock_timestamp() ELSE existing.updated_at END,
    shop_name = proposed.shop_name,
    phone = proposed.phone,
    whatsapp = proposed.whatsapp,
    email = proposed.email,
    address = proposed.address,
    google_maps_url = proposed.google_maps_url,
    instagram_url = proposed.instagram_url,
    exchange_rate_kes_to_usd = proposed.exchange_rate_kes_to_usd,
    delivery_flat_rate = proposed.delivery_flat_rate,
    free_delivery_threshold = proposed.free_delivery_threshold,
    pickup_available = proposed.pickup_available,
    storefront_preferences = existing.storefront_preferences || p_preferences
  WHERE id = existing.id RETURNING updated_at INTO version;
  RETURN version;
END;
$$;

REVOKE ALL ON FUNCTION public.save_website_settings(text, timestamptz, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_website_settings(text, timestamptz, jsonb, jsonb, jsonb, jsonb) TO service_role;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.is_website_settings_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = auth.jwt()->>'email' AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_website_settings_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_website_settings_owner() TO authenticated;

DROP POLICY IF EXISTS "Admins full access delivery_zones" ON public.delivery_zones;
CREATE POLICY "Owners read all zones" ON public.delivery_zones
  FOR SELECT TO authenticated USING (public.is_website_settings_owner());
CREATE POLICY "Owners create zones" ON public.delivery_zones
  FOR INSERT TO authenticated WITH CHECK (public.is_website_settings_owner());
CREATE POLICY "Owners update zones" ON public.delivery_zones
  FOR UPDATE TO authenticated
  USING (public.is_website_settings_owner()) WITH CHECK (public.is_website_settings_owner());

CREATE FUNCTION public.capture_delivery_zone_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) - 'updated_at' = to_jsonb(NEW) - 'updated_at' THEN
    RETURN NEW;
  END IF;
  NEW.updated_at := clock_timestamp();
  INSERT INTO public.shop_settings_audit(actor, changes)
    VALUES (coalesce(auth.jwt()->>'email', 'database'), jsonb_build_object(
      'delivery_zone', jsonb_build_object('from', to_jsonb(OLD), 'to', to_jsonb(NEW))
    ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_delivery_zone_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_delivery_zone_change BEFORE INSERT OR UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.capture_delivery_zone_change();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-branding', 'store-branding', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
