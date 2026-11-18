ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS publish_to_pos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_website_published boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode)
  WHERE barcode IS NOT NULL;

-- On a shared database, enforce POS visibility for the staff session used by
-- the till. The storefront reads with the anonymous role.
DO $$
BEGIN
  IF to_regprocedure('public.pos_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Respect POS publication for staff" ON public.products;
    CREATE POLICY "Respect POS publication for staff" ON public.products
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (publish_to_pos OR NOT public.pos_is_staff());
  END IF;
END;
$$;

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS exchange_rate_kes_to_usd numeric NOT NULL DEFAULT 130
  CHECK (exchange_rate_kes_to_usd > 0 AND exchange_rate_kes_to_usd < 'Infinity'::numeric);

-- The owner-only server action updates settings through the service role.
DROP POLICY IF EXISTS "Admins update shop_settings" ON public.shop_settings;
