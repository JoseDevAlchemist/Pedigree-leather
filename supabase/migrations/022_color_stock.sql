-- ===========================================================================
-- 022_color_stock.sql — stock belongs to a colourway, not a product
-- ===========================================================================
--
-- Version 014 is already `014_manual_mpesa.sql`, so this change lives at 022.
-- Renaming an applied migration would make `supabase migration list` lie about
-- what production has run.
--
-- The old model counted one pile of units per product. That cannot answer the
-- only question the shop asks — "is this bag in black available?" — and it hid
-- every colour as soon as the product hit zero. Stock now lives on
-- `product_colors`, and a product is available while at least one colour is.
--
-- Data migration: distribute the old product count across its colours, in
-- display order, preserving the total. A product with 3 units and 3 colours
-- becomes 1/1/1; 5 units across 3 colours becomes 2/2/1; 0 stays 0 everywhere.
-- ===========================================================================

ALTER TABLE public.product_colors
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.product_colors.stock_quantity IS
  'Units of this colourway on hand. 0 hides the colour from the storefront.';

-- If the old product-level column is still present, carry its count across.
-- The guard makes a direct re-run safe after the column has been dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'stock_quantity'
  ) THEN
    WITH ranked AS (
      SELECT
        pc.id,
        p.stock_quantity AS product_stock,
        row_number() OVER (
          PARTITION BY pc.product_id
          ORDER BY pc.sort_order, pc.color_name, pc.id
        ) - 1 AS colour_position,
        count(*) OVER (PARTITION BY pc.product_id) AS colour_count
      FROM public.product_colors pc
      JOIN public.products p ON p.id = pc.product_id
    )
    UPDATE public.product_colors pc
    SET stock_quantity = CASE
      WHEN ranked.product_stock <= 0 THEN 0
      ELSE
        floor(ranked.product_stock::numeric / ranked.colour_count)::integer
        + CASE
            WHEN ranked.colour_position < (ranked.product_stock % ranked.colour_count)
              THEN 1
            ELSE 0
          END
    END
    FROM ranked
    WHERE pc.id = ranked.id;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_colors_stock_quantity_check'
      AND conrelid = 'public.product_colors'::regclass
  ) THEN
    ALTER TABLE public.product_colors
      ADD CONSTRAINT product_colors_stock_quantity_check
      CHECK (stock_quantity >= 0);
  END IF;
END
$$;

-- The storefront asks "does this product have a colour with stock?" on every
-- grid and detail read, so the (product, stock) pair is the useful index.
CREATE INDEX IF NOT EXISTS idx_colors_product_stock
  ON public.product_colors(product_id, stock_quantity);

-- Replace the old product-level decrement with a colour-level one. The function
-- body is plpgsql text, so Postgres does not track its dependency on the column
-- being dropped below; leaving it in place would only fail at checkout.
CREATE OR REPLACE FUNCTION public.decrement_color_stock(
  color_id uuid,
  qty integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_quantity integer;
BEGIN
  IF qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  UPDATE public.product_colors pc
  SET stock_quantity = pc.stock_quantity - qty
  WHERE pc.id = color_id
    AND pc.stock_quantity >= qty
  RETURNING pc.stock_quantity
  INTO new_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for colour %', color_id
      USING ERRCODE = 'insufficient_stock';
  END IF;

  RETURN new_quantity;
END;
$$;

DROP FUNCTION IF EXISTS public.decrement_stock(uuid, integer);

ALTER TABLE public.products
  DROP COLUMN IF EXISTS stock_quantity;
