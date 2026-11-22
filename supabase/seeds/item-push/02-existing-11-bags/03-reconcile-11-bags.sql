-- SQL Editor form of the existing read-only batch audit. Use after confirmed commit.
begin read only;

with batch as (
  select * from public.excel_catalogue_batches where batch_id = '700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5'
), variants as (
  select a.*, v.value as variant
  from public.excel_catalogue_batch_audit a join batch b using (batch_id)
  left join lateral jsonb_array_elements(a.variants) v(value) on true
), checked as (
  select variants.*, case
    when outcome = 'SKIPPED' then null
    else coalesce(variant->'approved_quantity' = variant->'committed_quantity'
      and variant->'approved_delta' = variant->'stock_quantity_applied', false)
  end as reconciled
  from variants
)
select jsonb_build_object(
  'batch_id', '700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5',
  'confirmation', case when exists (select 1 from batch) then 'COMMITTED' else 'NO_COMMITTED_BATCH' end,
  'workbook_sha256', (select workbook_sha256 from batch),
  'recorded_at', (select recorded_at from batch),
  'imported_products', count(distinct application_id) filter (where outcome = 'IMPORTED'),
  'skipped_products', count(distinct application_id) filter (where outcome = 'SKIPPED'),
  'approved_variant_units', sum((variant->>'approved_quantity')::integer) filter (where outcome = 'IMPORTED'),
  'committed_variant_units', sum((variant->>'committed_quantity')::integer) filter (where outcome = 'IMPORTED'),
  'approved_stock_delta', coalesce(sum((variant->>'approved_delta')::integer), 0),
  'committed_stock_delta', coalesce(sum((variant->>'stock_quantity_applied')::integer), 0),
  'mismatched_variants', count(*) filter (where reconciled is false),
  'records', coalesce(jsonb_agg(jsonb_build_object(
    'application_id', application_id, 'product_id', product_id, 'product_code', product_code,
    'source_rows', source_rows, 'action', action, 'outcome', outcome,
    'recorded_at', recorded_at, 'variant', variant, 'reconciled', reconciled
  ) order by product_code, variant->>'color_id', variant->>'size_id'), '[]'::jsonb)
)
from checked;

rollback;
