-- ===========================================================================
-- 023_legal_pages.sql — legal pages (privacy, terms, returns)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.legal_pages (
  slug text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read legal pages" ON public.legal_pages;
CREATE POLICY "Public can read legal pages"
  ON public.legal_pages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated full access legal pages" ON public.legal_pages;
CREATE POLICY "Authenticated full access legal pages"
  ON public.legal_pages FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.legal_pages (slug, title, content) VALUES
  ('privacy', 'Privacy Policy', 'This is a placeholder Privacy Policy for Pedigree Leather. Update this via the database.'),
  ('terms', 'Terms of Service', 'This is a placeholder Terms of Service for Pedigree Leather. Update this via the database.'),
  ('returns', 'Returns Policy', 'This is a placeholder Returns Policy for Pedigree Leather. Update this via the database.')
ON CONFLICT (slug) DO NOTHING;
