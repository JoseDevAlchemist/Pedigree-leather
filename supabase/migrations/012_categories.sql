-- ===========================================================================
-- 012_categories.sql — admin-managed product categories
-- ===========================================================================
-- Run this in the Supabase SQL Editor, or with the Supabase CLI:
--   supabase db push                      (from a linked project)
--   supabase migration up                 (local dev stack)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- categories — a tree of product categories owned by the shop owner
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  slug text NOT NULL UNIQUE,

  -- NULL means a top-level category. A category's children inherit its place in
  -- the nav but keep their own slug and ordering.
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,

  -- Lower numbers sort first. The admin can reorder with drag and drop.
  display_order integer NOT NULL DEFAULT 0,

  -- Inactive categories are hidden from the shop entirely (RLS below).
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- ---------------------------------------------------------------------------
-- products.category_id — links a product to a category
-- ---------------------------------------------------------------------------
-- The existing `category` text column ('bag' | 'shoe') is kept for backfill
-- safety and is deprecated. New code writes `category_id`; the shop's category
-- routes use it. Do not remove `category` until every read path has migrated.
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

-- Authenticated full access for the admin UI (service role bypasses RLS, so
-- this policy only matters for the session-aware client, which the admin uses).
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
-- Map 'bag' -> the 'Bags' category, 'shoe' -> the 'Shoes' category. Products
-- already assigned a more specific category by a later migration keep it.
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

-- ===========================================================================
-- Deprecated: `products.category` (text, 'bag'|'shoe') remains for backfill
-- safety. All new code uses `category_id`. Remove this column once every read
-- path has migrated to categories.
-- ===========================================================================
