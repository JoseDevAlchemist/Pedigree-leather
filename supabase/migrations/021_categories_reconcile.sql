-- ===========================================================================
-- 021_categories_reconcile.sql — apply the dynamic taxonomy to the linked DB
-- ===========================================================================
-- `012_categories.sql` already contains this schema, but the linked project's
-- migration history recorded a different migration as version 012 (the POS
-- line, 015–020). Re-running 012 by version is therefore a no-op there, even
-- though `public.categories` and `products.category_id` do not exist.
--
-- This migration is the additive, idempotent reconciliation. It is safe to run
-- on a database where 012 *was* applied: every statement checks first.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- categories — a tree of product categories owned by the shop owner
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  slug text NOT NULL,

  -- NULL means a top-level category. A category's children inherit its place in
  -- the nav but keep their own slug and ordering.
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,

  -- Lower numbers sort first. The admin can reorder with drag and drop.
  display_order integer NOT NULL DEFAULT 0,

  -- Inactive categories are hidden from the shop entirely (RLS below).
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- If an older partial table exists, bring it up to the shape the app expects.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- The slug is the public URL segment and the upsert conflict target below.
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- ---------------------------------------------------------------------------
-- products.category_id — links a product to a category
-- ---------------------------------------------------------------------------
-- The existing `category` text column ('bag' | 'shoe') is kept for the two
-- legacy detail routes and for backfill safety. New code writes `category_id`.
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Public reads only active categories. Writes go through the service role
-- (lib/supabase/admin.ts) and bypass RLS entirely.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active categories" ON categories;
CREATE POLICY "Public can read active categories"
  ON categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated full access categories" ON categories;
CREATE POLICY "Authenticated full access categories"
  ON categories FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Seed: two parents and five children
-- ---------------------------------------------------------------------------
INSERT INTO categories (name, slug, parent_id, display_order, is_active)
VALUES
  ('Bags', 'bags', NULL, 1, true),
  ('Shoes', 'shoes', NULL, 2, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, display_order, is_active)
VALUES
  ('Handbags', 'handbags', (SELECT id FROM categories WHERE slug = 'bags' LIMIT 1), 1, true),
  ('Laptop Bags', 'laptop-bags', (SELECT id FROM categories WHERE slug = 'bags' LIMIT 1), 2, true),
  ('Official Shoes', 'official-shoes', (SELECT id FROM categories WHERE slug = 'shoes' LIMIT 1), 1, true),
  ('Sneakers', 'sneakers', (SELECT id FROM categories WHERE slug = 'shoes' LIMIT 1), 2, true),
  ('Belts', 'belts', NULL, 3, true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill products.category_id from the existing `category` column.
-- ---------------------------------------------------------------------------
UPDATE products
SET category_id = (
  SELECT c.id FROM categories c
  WHERE c.slug = CASE
    WHEN products.category = 'bag' THEN 'bags'
    WHEN products.category = 'shoe' THEN 'shoes'
    ELSE NULL
  END
)
WHERE category_id IS NULL
  AND products.category IN ('bag', 'shoe');
