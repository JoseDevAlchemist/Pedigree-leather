-- ===========================================================================
-- seed.sql — the current mock catalogue, as real rows
-- ===========================================================================
--
-- Run in the Supabase SQL Editor, or with `supabase db reset` / psql.
-- Safe to run as many times as you like: every insert is ON CONFLICT DO
-- NOTHING, keyed on the immutable slug, so re-seeding refreshes nothing and
-- breaks nothing. To start over from scratch, see the reset note at the
-- bottom of this file.
--
-- GENERATED FILE. It was produced from lib/mock-data.ts by a script so that
-- the seed and the mock data cannot drift apart. If you change a product in
-- mock-data.ts, regenerate this — do not hand-edit it, or the two will
-- disagree and the cause will be hard to find.
--
-- ---------------------------------------------------------------------------
-- No product_images rows
-- ---------------------------------------------------------------------------
-- Only products and product_colors are inserted. Image slots are not
-- pre-created, because the set of views a product has is derived from its
-- category (bag and shoe carry different five) rather than stored — see the
-- note in 001_initial.sql. The read path asks for the category's angles and
-- overlays whatever image rows exist; a slot with no row is a slot with no
-- photograph, which is exactly what the colour-block placeholder draws.
-- Pre-creating slots would mean every category change needed slot surgery.
-- ===========================================================================

-- Karura Tote  (karura-tote)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Karura Tote', 'karura-tote', 'A wide-mouth tote in full-grain leather that stands up on its own. It is unlined and open at the top, so it packs flat when it is empty.', 'bag', 18500, 0, 12, true, true, '2026-09-05T08:00:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 0 FROM products WHERE slug = 'karura-tote'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'karura-tote'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Forest', '#2D3E2D', 2 FROM products WHERE slug = 'karura-tote'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 3 FROM products WHERE slug = 'karura-tote'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Ngong Satchel  (ngong-satchel)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Ngong Satchel', 'ngong-satchel', 'A flat satchel with one flap and a solid brass turn-lock, cut from a single hide so the grain runs unbroken across the front. Fits a 13-inch laptop and a folio.', 'bag', 14000, 15, 8, true, true, '2026-09-08T11:30:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Oxblood', '#4A1C1C', 0 FROM products WHERE slug = 'ngong-satchel'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 1 FROM products WHERE slug = 'ngong-satchel'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 2 FROM products WHERE slug = 'ngong-satchel'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Kilimanjaro Weekender  (kilimanjaro-weekender)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Kilimanjaro Weekender', 'kilimanjaro-weekender', 'Sized for two nights, with a wide gusset, a reinforced base and a shoulder strap that detaches and stows in the side pocket. Forty-five litres.', 'bag', 23500, 0, 5, true, true, '2026-09-14T16:20:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 0 FROM products WHERE slug = 'kilimanjaro-weekender'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 1 FROM products WHERE slug = 'kilimanjaro-weekender'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Oxblood', '#4A1C1C', 2 FROM products WHERE slug = 'kilimanjaro-weekender'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Rift Valley Backpack  (rift-valley-backpack)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Rift Valley Backpack', 'rift-valley-backpack', 'A roll-top pack with waxed canvas side panels and a flap that stiffens as it ages. The roll closure keeps rain out and takes up less room than a zip does when the bag is half empty.', 'bag', 16500, 10, 0, false, true, '2026-09-21T10:05:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Forest', '#2D3E2D', 0 FROM products WHERE slug = 'rift-valley-backpack'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'rift-valley-backpack'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cream', '#EFE3D2', 2 FROM products WHERE slug = 'rift-valley-backpack'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 3 FROM products WHERE slug = 'rift-valley-backpack'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Lamu Crossbody  (lamu-crossbody)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Lamu Crossbody', 'lamu-crossbody', 'A small flat bag on a thin strap, for a phone, a card holder and keys. It is the thinnest thing we make, roughly the size of a paperback.', 'bag', 9500, 20, 15, true, true, '2026-09-29T14:40:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cream', '#EFE3D2', 0 FROM products WHERE slug = 'lamu-crossbody'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 1 FROM products WHERE slug = 'lamu-crossbody'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 2 FROM products WHERE slug = 'lamu-crossbody'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Karen Briefcase  (karen-briefcase)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Karen Briefcase', 'karen-briefcase', 'A structured briefcase with a three-part zip gusset, so it opens flat for a laptop and closes to a hard line for the office. Brass feet underneath keep it off a wet floor.', 'bag', 22000, 0, 3, false, true, '2026-10-03T09:12:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Oxblood', '#4A1C1C', 0 FROM products WHERE slug = 'karen-briefcase'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'karen-briefcase'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 2 FROM products WHERE slug = 'karen-briefcase'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Karura Derby  (karura-derby)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Karura Derby', 'karura-derby', 'An open-laced derby cut from a single hide, so the vamp and the quarters are the same leather. Goodyear-welted, so it can be resoled rather than replaced.', 'shoe', 18500, 0, 8, true, true, '2026-09-06T08:45:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 0 FROM products WHERE slug = 'karura-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'karura-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 2 FROM products WHERE slug = 'karura-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Nyota Derby  (nyota-derby)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Nyota Derby', 'nyota-derby', 'Hand-stitched leather derby with a Goodyear-welted sole and a burnished finish that deepens where your foot flexes it.', 'shoe', 16500, 10, 6, true, true, '2026-09-11T13:15:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Oxblood', '#4A1C1C', 0 FROM products WHERE slug = 'nyota-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'nyota-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 2 FROM products WHERE slug = 'nyota-derby'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Turkana Loafer  (turkana-loafer)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Turkana Loafer', 'turkana-loafer', 'A moccasin-stitched loafer with no laces and no heel, so it packs flat. Unlined, and it creases along the vamp the way a shoe should.', 'shoe', 12500, 0, 11, false, true, '2026-09-17T10:30:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 0 FROM products WHERE slug = 'turkana-loafer'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 1 FROM products WHERE slug = 'turkana-loafer'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cream', '#EFE3D2', 2 FROM products WHERE slug = 'turkana-loafer'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Lamu Chukka  (lamu-chukka)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Lamu Chukka', 'lamu-chukka', 'Two eyelets, a storm welt and a crepe sole. The lightest thing we make on a last, and the one that wears a scuff fastest.', 'shoe', 14500, 0, 0, false, true, '2026-09-23T15:05:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Forest', '#2D3E2D', 0 FROM products WHERE slug = 'lamu-chukka'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 1 FROM products WHERE slug = 'lamu-chukka'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 2 FROM products WHERE slug = 'lamu-chukka'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Rift Valley Boot  (rift-valley-boot)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Rift Valley Boot', 'rift-valley-boot', 'A six-eyelet service boot on a commando sole, stitched at 6 stitches to the inch so it can be repaired at any cobbler in the country.', 'shoe', 22000, 15, 4, false, true, '2026-09-26T09:00:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Black', '#1C1C1C', 0 FROM products WHERE slug = 'rift-valley-boot'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Forest', '#2D3E2D', 1 FROM products WHERE slug = 'rift-valley-boot'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 2 FROM products WHERE slug = 'rift-valley-boot'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- Karura Derby in Suede  (karura-derby-suede)
INSERT INTO products (name, slug, description, category, base_price, discount_percent, stock_quantity, featured, active, created_at)
VALUES ('Karura Derby in Suede', 'karura-derby-suede', 'The same last as our plain derby, in a waxed suede that beads in the rain and dries to a different shade every time. Goodyear-welted like the rest.', 'shoe', 17500, 0, 7, true, true, '2026-10-01T11:20:00.000Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Tan', '#C19A6B', 0 FROM products WHERE slug = 'karura-derby-suede'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Cognac', '#8B4513', 1 FROM products WHERE slug = 'karura-derby-suede'
ON CONFLICT (product_id, color_name) DO NOTHING;
INSERT INTO product_colors (product_id, color_name, color_hex, sort_order)
SELECT id, 'Forest', '#2D3E2D', 2 FROM products WHERE slug = 'karura-derby-suede'
ON CONFLICT (product_id, color_name) DO NOTHING;

-- ===========================================================================
-- Sanity check
-- ---------------------------------------------------------------------------
-- Expect 12 products, 6 of each category, 38 colours, 7 featured.
-- ===========================================================================
SELECT
  category,
  count(*)                       AS products,
  sum(stock_quantity)            AS units,
  count(*) FILTER (WHERE featured) AS featured
FROM products
GROUP BY category
ORDER BY category;

SELECT
  count(*) AS colours
FROM product_colors;

-- ===========================================================================
-- Resetting
-- ---------------------------------------------------------------------------
-- To wipe the catalogue and re-seed from scratch:
--
--   TRUNCATE products CASCADE;   -- colours and images go with it
--
-- Then re-run this file. Note this deletes real data if you have added
-- products through the admin since seeding.
-- ===========================================================================
