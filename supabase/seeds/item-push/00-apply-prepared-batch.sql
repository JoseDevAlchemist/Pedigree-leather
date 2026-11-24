-- Shared body. Included by a nonempty numbered seed inside its transaction.
DO $item_push_apply$
DECLARE
  prepared jsonb;
  plan jsonb;
  category_uuid uuid;
  size_system text;
  commit_batch_id text;
  result jsonb;
BEGIN
  SELECT payload INTO STRICT prepared FROM pg_temp.item_push_input;
  IF current_setting('item_push.approved_batch_id', true) IS DISTINCT FROM prepared->>'prepared_batch_id' THEN
    RAISE EXCEPTION 'item_push_batch_approval_required';
  END IF;

  -- The operator verifies the actual connection against this approved ref.
  -- This setting records the target in the bound plan and is not attestation.
  IF coalesce(current_setting('item_push.project_ref', true), '') !~ '^[a-z0-9]{20}$'
     OR current_setting('item_push.project_ref', true) = 'scvscxbxfpjqbqkfkset' THEN
    RAISE EXCEPTION 'item_push_new_project_approval_required';
  END IF;

  SELECT id INTO STRICT category_uuid
  FROM public.categories
  WHERE slug = prepared->>'category_slug' AND parent_id IS NULL AND is_active
  FOR SHARE;

  IF prepared->>'category_slug' = 'shoes' THEN
    size_system := btrim(current_setting('item_push.size_system', true));
    IF coalesce(length(size_system), 0) NOT BETWEEN 1 AND 32 THEN
      RAISE EXCEPTION 'item_push_confirm_shoe_size_system';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'workbook_sha256', prepared->>'workbook_sha256',
    'prepared_batch_id', prepared->>'prepared_batch_id',
    'project_ref', current_setting('item_push.project_ref', true),
    'products', jsonb_agg(value || jsonb_build_object(
      'category_id', category_uuid, 'size_system', size_system
    ) ORDER BY ordinal)
  ) INTO plan
  FROM jsonb_array_elements(prepared->'products') WITH ORDINALITY AS products(value, ordinal);

  commit_batch_id := encode(sha256(convert_to(plan::text, 'UTF8')), 'hex');
  result := public.apply_excel_catalogue(plan || jsonb_build_object('batch_id', commit_batch_id));
  RAISE NOTICE 'Batch % transaction result %. Confirm COMMIT through the separate audit receipt.',
    commit_batch_id, result;
END;
$item_push_apply$;
