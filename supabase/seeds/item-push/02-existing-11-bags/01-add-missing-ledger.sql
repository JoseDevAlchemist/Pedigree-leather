-- Add only absent import receipt objects, using the existing canonical ledger.
-- Confirm scvscxbxfpjqbqkfkset in Supabase SQL Editor before approved execution.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $minimal_ledger$
BEGIN
  -- Fail before changing anything if the shared catalogue/stock contract is absent.
  PERFORM id,name,slug,description,category,category_id,barcode,base_price,active,is_website_published,publish_to_pos
    FROM public.products LIMIT 0;
  PERFORM id,slug,parent_id,is_active FROM public.categories LIMIT 0;
  PERFORM id,product_id,color_name,color_hex,sort_order,stock_quantity FROM public.product_colors LIMIT 0;
  PERFORM product_id,color_id,delta,quantity_after,reason FROM public.stock_movements LIMIT 0;
  -- Canonical nullable movement reference from POS migration 20261116200000.
  ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reference_uuid uuid;

  IF to_regclass('public.excel_catalogue_imports') IS NULL THEN
    create table public.excel_catalogue_imports (
      workbook_sha256 text not null check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
      sheet_name text not null,
      source_row integer not null check (source_row > 0),
      product_id uuid not null references public.products(id),
      approved_product jsonb not null,
      application_id uuid not null,
      applied_at timestamptz not null default now(),
      primary key (workbook_sha256, sheet_name, source_row)
    );
    ALTER TABLE public.excel_catalogue_imports ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.excel_catalogue_imports FROM PUBLIC, anon, authenticated, service_role;
    GRANT SELECT ON public.excel_catalogue_imports TO service_role;
  END IF;

  IF to_regclass('public.excel_catalogue_batches') IS NULL THEN
    create table public.excel_catalogue_batches (
      batch_id text primary key check (batch_id ~ '^[a-f0-9]{64}$'),
      workbook_sha256 text not null check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
      plan_digest text not null,
      recorded_at timestamptz not null default clock_timestamp()
    );
    ALTER TABLE public.excel_catalogue_batches ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.excel_catalogue_batches FROM PUBLIC, anon, authenticated, service_role;
    GRANT SELECT ON public.excel_catalogue_batches TO service_role;
  END IF;

  IF to_regclass('public.excel_catalogue_batch_audit') IS NULL THEN
    create table public.excel_catalogue_batch_audit (
      batch_id text not null references public.excel_catalogue_batches(batch_id),
      application_id uuid not null,
      product_id uuid not null,
      product_code text not null,
      source_rows jsonb not null,
      action text not null check (action in ('create','link','reconcile')),
      outcome text not null check (outcome in ('IMPORTED','SKIPPED')),
      variants jsonb not null,
      recorded_at timestamptz not null default clock_timestamp(),
      primary key (batch_id, application_id)
    );
    CREATE UNIQUE INDEX excel_catalogue_applied_variant_snapshot
      ON public.excel_catalogue_batch_audit(application_id) WHERE outcome='IMPORTED';
    ALTER TABLE public.excel_catalogue_batch_audit ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.excel_catalogue_batch_audit FROM PUBLIC, anon, authenticated, service_role;
    GRANT SELECT ON public.excel_catalogue_batch_audit TO service_role;
  END IF;

  -- Existing ledger objects must match the required interface. Do not replace
  -- tables, functions or grants to repair an incompatible live deployment.
  PERFORM workbook_sha256,sheet_name,source_row,product_id,approved_product,application_id,applied_at
    FROM public.excel_catalogue_imports LIMIT 0;
  PERFORM batch_id,workbook_sha256,plan_digest,recorded_at FROM public.excel_catalogue_batches LIMIT 0;
  PERFORM batch_id,application_id,product_id,product_code,source_rows,action,outcome,variants,recorded_at
    FROM public.excel_catalogue_batch_audit LIMIT 0;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.excel_catalogue_imports'::regclass AND contype='p'
    AND pg_get_constraintdef(oid)='PRIMARY KEY (workbook_sha256, sheet_name, source_row)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.excel_catalogue_batches'::regclass AND contype='p'
    AND pg_get_constraintdef(oid)='PRIMARY KEY (batch_id)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.excel_catalogue_batch_audit'::regclass AND contype='p'
    AND pg_get_constraintdef(oid)='PRIMARY KEY (batch_id, application_id)'
  ) THEN RAISE EXCEPTION 'existing_ledger_requires_review'; END IF;
END;
$minimal_ledger$;

COMMIT;
