-- EXECUTE ONLY after separately recorded approval of the exact destination-bound plan.
-- This template accepts a future reviewed plan covering all four CREATE/LINK decisions.
-- REVIEW or SKIP decisions require a separately reviewed plan for the eligible subset.
-- It cannot establish the server's identity. Independently verify the connection's project ref.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE TEMP TABLE item_push_reviewed_plan ON COMMIT DROP AS
SELECT :'approved_plan_json'::jsonb AS plan, :'approved_plan_sha256'::text AS approved_hash,
       :'approved_project_ref'::text AS project_ref, :'verified_bags_batch_id'::text AS bags_batch_id;

DO $execute_reviewed$
DECLARE
  request record;
  plan jsonb;
  category_uuid uuid;
  batch_result jsonb;
BEGIN
  SELECT * INTO STRICT request FROM pg_temp.item_push_reviewed_plan;
  plan := request.plan;
  IF request.project_ref <> 'scvscxbxfpjqbqkfkset'
     OR plan->>'project_ref' IS DISTINCT FROM request.project_ref
     OR plan->>'prepared_batch_id' IS DISTINCT FROM 'd6b707687348b2230ef6f0ace98815ea100094f6d681ab4e723e99866b9c9b31'
     OR plan->>'workbook_sha256' IS DISTINCT FROM 'a299523b77936493abe5079d45a1687b6405ec75a4d0fcc3b0a832d54dc89aa5'
     OR request.approved_hash IS DISTINCT FROM encode(sha256(convert_to(plan::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION 'item_push_exact_plan_approval_required';
  END IF;

  IF jsonb_typeof(plan->'products') IS DISTINCT FROM 'array'
     OR (SELECT array_agg(e->>'code' ORDER BY (e->>'code') COLLATE "C")
         FROM jsonb_array_elements(plan->'products') e)
        IS DISTINCT FROM ARRAY['LSS- 6H061','SS- SC','SS-6008','SS-DC']
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(plan->'products') e
       WHERE coalesce(e->>'action','') NOT IN ('create','link')
         OR e->>'category' IS DISTINCT FROM 'shoe'
         OR coalesce(length(btrim(e->>'size_system')),0) NOT BETWEEN 1 AND 32) THEN
    RAISE EXCEPTION 'item_push_four_reviewed_shoes_required';
  END IF;

  -- Require the independently reconciled bags receipt. Current balances can
  -- differ after sales, so only committed import snapshots are inspected here.
  IF request.bags_batch_id IS DISTINCT FROM
       '700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5'
     OR NOT EXISTS (SELECT 1 FROM public.excel_catalogue_batches b
     WHERE b.batch_id=request.bags_batch_id AND b.workbook_sha256=plan->>'workbook_sha256')
     OR (SELECT array_agg(DISTINCT l.source_row ORDER BY l.source_row)
         FROM public.excel_catalogue_imports l JOIN public.excel_catalogue_batch_audit a
           ON a.application_id=l.application_id AND a.product_id=l.product_id
         WHERE a.batch_id=request.bags_batch_id AND a.outcome='IMPORTED'
           AND l.workbook_sha256=plan->>'workbook_sha256'
           AND l.sheet_name='CN Working Sheet' AND l.source_row BETWEEN 5 AND 16)
       IS DISTINCT FROM ARRAY[6,7,8,9,10,11,12,13,14,15,16]
     OR (SELECT count(*) FROM public.excel_catalogue_batch_audit a
         WHERE a.batch_id=request.bags_batch_id AND a.outcome='IMPORTED') <> 11
     OR (SELECT sum((v->>'stock_quantity_applied')::integer)
         FROM public.excel_catalogue_batch_audit a
         CROSS JOIN LATERAL jsonb_array_elements(a.variants) v
         WHERE a.batch_id=request.bags_batch_id AND a.outcome='IMPORTED') IS DISTINCT FROM 54
     OR EXISTS (SELECT 1 FROM public.excel_catalogue_batch_audit a
         CROSS JOIN LATERAL jsonb_array_elements(a.variants) v
         WHERE a.batch_id=request.bags_batch_id AND a.outcome='IMPORTED'
           AND (v->'approved_quantity' IS DISTINCT FROM v->'committed_quantity'
             OR v->'approved_delta' IS DISTINCT FROM v->'stock_quantity_applied')) THEN
    RAISE EXCEPTION 'item_push_previous_bags_receipt_required';
  END IF;

  SELECT id INTO STRICT category_uuid FROM public.categories
    WHERE slug='shoes' AND parent_id IS NULL AND is_active FOR SHARE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(plan->'products') e
             WHERE e->>'category_id' IS DISTINCT FROM category_uuid::text) THEN
    RAISE EXCEPTION 'item_push_verified_shoes_root_required';
  END IF;

  -- Replay no-ops only on an identical committed plan.
  LOCK TABLE public.products IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.excel_catalogue_batches b WHERE b.batch_id=plan->>'batch_id'
     AND b.plan_digest=request.approved_hash) THEN
    RAISE NOTICE 'Matching batch already committed. Open its existing receipt.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(plan->'products') e JOIN public.products p
     ON lower(regexp_replace(btrim(p.barcode),'[[:space:]]+','','g')) =
        lower(regexp_replace(btrim(e->>'code'),'[[:space:]]+','','g')) OR p.slug=e->>'slug'
    WHERE e->>'action'='create' OR p.id::text IS DISTINCT FROM e->>'product_id'
  ) THEN
    RAISE EXCEPTION 'item_push_unreviewed_existing_identity';
  END IF;

  batch_result := public.apply_excel_catalogue(plan);
  RAISE NOTICE 'Batch % transaction result %. Confirm commit in a separate session.',
    plan->>'batch_id',batch_result;
END;
$execute_reviewed$;

COMMIT;
