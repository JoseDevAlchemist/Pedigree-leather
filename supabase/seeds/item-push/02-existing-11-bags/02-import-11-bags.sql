-- Supabase SQL Editor. Intended project scvscxbxfpjqbqkfkset only.
-- Independently confirm the Dashboard project before running.
-- After separate approval of this exact payload, replace NULL with:
-- 700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $approved_import$
DECLARE
  approval_id constant text := NULL;
  approved_payload constant text := $opening_bags${"category_slug":"bags","prepared_batch_id":"742a73ee0a8ac8b746589c81683257ca84c89c242bcddbfce99889a75b6d4fca","products":[{"action":"create","allow_same_name":true,"base_price":12550,"category":"bag","category_id":null,"code":"LB-5569","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Khaki","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-5569-6ef8bcc0d966","source_rows":[{"base_price_candidate":12550,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D6","colour":null,"customer_description":null,"inventory":[{"cell":"E6","colour":"Black","quantity":1,"size":null},{"cell":"L6","colour":"Khaki","quantity":1,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B6","numeric_units":2,"pedigree_code":"LB-5569","price_cell":"AT6","raw_cells":{"AS6":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"2"},"AT6":{"style":"4","type":"n","value":"12550"},"B6":null,"C6":{"style":"40","type":"n","value":"5569"},"D6":{"style":"3","type":"s","value":"LB-5569"},"E6":{"style":"3","type":"n","value":"1"},"L6":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":6,"sheet":"CN Working Sheet","source_code":"5569","source_price":"12550","workbook_row_total":2}]},{"action":"create","allow_same_name":true,"base_price":20350,"category":"bag","category_id":null,"code":"LB-6867","colours":[{"hex":"#808080","name":"Black","quantity":2,"sizes":[]},{"hex":"#808080","name":"Golden Brown","quantity":2,"sizes":[]},{"hex":"#808080","name":"Gray","quantity":2,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-6867-2a9c3d596967","source_rows":[{"base_price_candidate":20350,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D7","colour":null,"customer_description":null,"inventory":[{"cell":"E7","colour":"Black","quantity":2,"size":null},{"cell":"AE7","colour":"Golden Brown","quantity":2,"size":null},{"cell":"AH7","colour":"Gray","quantity":2,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B7","numeric_units":6,"pedigree_code":"LB-6867","price_cell":"AT7","raw_cells":{"AE7":{"style":"3","type":"n","value":"2"},"AH7":{"style":"3","type":"n","value":"2"},"AS7":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"6"},"AT7":{"style":"4","type":"n","value":"20350"},"B7":null,"C7":{"style":"40","type":"n","value":"6867"},"D7":{"style":"3","type":"s","value":"LB-6867"},"E7":{"style":"3","type":"n","value":"2"}},"recorded_name":null,"review_cells":[],"row":7,"sheet":"CN Working Sheet","source_code":"6867","source_price":"20350","workbook_row_total":6}]},{"action":"create","allow_same_name":true,"base_price":22400,"category":"bag","category_id":null,"code":"LB-2419","colours":[{"hex":"#808080","name":"Black","quantity":4,"sizes":[]},{"hex":"#808080","name":"Milkshake","quantity":3,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-2419-9339dcd69079","source_rows":[{"base_price_candidate":22400,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D8","colour":null,"customer_description":null,"inventory":[{"cell":"E8","colour":"Black","quantity":4,"size":null},{"cell":"K8","colour":"Milkshake","quantity":3,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B8","numeric_units":7,"pedigree_code":"LB-2419","price_cell":"AT8","raw_cells":{"AS8":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"7"},"AT8":{"style":"4","type":"n","value":"22400"},"B8":null,"C8":{"style":"40","type":"n","value":"2419"},"D8":{"style":"3","type":"s","value":"LB-2419"},"E8":{"style":"3","type":"n","value":"4"},"K8":{"style":"3","type":"n","value":"3"}},"recorded_name":null,"review_cells":[],"row":8,"sheet":"CN Working Sheet","source_code":"2419","source_price":"22400","workbook_row_total":7}]},{"action":"create","allow_same_name":true,"base_price":18400,"category":"bag","category_id":null,"code":"LB-8931","colours":[{"hex":"#808080","name":"Black","quantity":2,"sizes":[]},{"hex":"#808080","name":"Golden Brown","quantity":2,"sizes":[]},{"hex":"#808080","name":"Chestnut Brown","quantity":0,"sizes":[]},{"hex":"#808080","name":"Pottery Brown","quantity":0,"sizes":[]},{"hex":"#808080","name":"Elephant Gray","quantity":2,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-8931-90854a965ad7","source_rows":[{"base_price_candidate":18400,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D9","colour":null,"customer_description":null,"inventory":[{"cell":"E9","colour":"Black","quantity":2,"size":null},{"cell":"AE9","colour":"Golden Brown","quantity":2,"size":null},{"cell":"AF9","colour":"Chestnut Brown","quantity":0,"size":null},{"cell":"AG9","colour":"Pottery Brown","quantity":0,"size":null},{"cell":"AI9","colour":"Elephant Gray","quantity":2,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B9","numeric_units":6,"pedigree_code":"LB-8931","price_cell":"AT9","raw_cells":{"AE9":{"style":"3","type":"n","value":"2"},"AF9":{"style":"3","type":"n","value":"0"},"AG9":{"style":"3","type":"n","value":"0"},"AI9":{"style":"3","type":"n","value":"2"},"AS9":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"6"},"AT9":{"style":"4","type":"n","value":"18400"},"B9":null,"C9":{"style":"40","type":"n","value":"8931"},"D9":{"style":"3","type":"s","value":"LB-8931"},"E9":{"style":"3","type":"n","value":"2"}},"recorded_name":null,"review_cells":[],"row":9,"sheet":"CN Working Sheet","source_code":"8931","source_price":"18400","workbook_row_total":6}]},{"action":"create","allow_same_name":true,"base_price":23600,"category":"bag","category_id":null,"code":"LB-9343","colours":[{"hex":"#808080","name":"Black","quantity":2,"sizes":[]},{"hex":"#808080","name":"White","quantity":2,"sizes":[]},{"hex":"#808080","name":"Caramel","quantity":2,"sizes":[]},{"hex":"#808080","name":"Blue","quantity":2,"sizes":[]},{"hex":"#808080","name":"Chestnut Brown","quantity":2,"sizes":[]},{"hex":"#808080","name":"Pottery Brown","quantity":0,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-9343-f4eb6683fb56","source_rows":[{"base_price_candidate":23600,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D10","colour":null,"customer_description":null,"inventory":[{"cell":"E10","colour":"Black","quantity":2,"size":null},{"cell":"H10","colour":"White","quantity":2,"size":null},{"cell":"N10","colour":"Caramel","quantity":2,"size":null},{"cell":"R10","colour":"Blue","quantity":2,"size":null},{"cell":"AF10","colour":"Chestnut Brown","quantity":2,"size":null},{"cell":"AG10","colour":"Pottery Brown","quantity":0,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B10","numeric_units":10,"pedigree_code":"LB-9343","price_cell":"AT10","raw_cells":{"AF10":{"style":"3","type":"n","value":"2"},"AG10":{"style":"3","type":"n","value":"0"},"AS10":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"10"},"AT10":{"style":"4","type":"n","value":"23600"},"B10":null,"C10":{"style":"40","type":"n","value":"9343"},"D10":{"style":"3","type":"s","value":"LB-9343"},"E10":{"style":"3","type":"n","value":"2"},"H10":{"style":"3","type":"n","value":"2"},"N10":{"style":"3","type":"n","value":"2"},"R10":{"style":"3","type":"n","value":"2"}},"recorded_name":null,"review_cells":[],"row":10,"sheet":"CN Working Sheet","source_code":"9343","source_price":"23600","workbook_row_total":10}]},{"action":"create","allow_same_name":true,"base_price":23600,"category":"bag","category_id":null,"code":"LB-8710","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Caramel","quantity":1,"sizes":[]},{"hex":"#808080","name":"Almond Green","quantity":1,"sizes":[]},{"hex":"#808080","name":"Gray","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-8710-8a9236a31991","source_rows":[{"base_price_candidate":23600,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D11","colour":null,"customer_description":null,"inventory":[{"cell":"E11","colour":"Black","quantity":1,"size":null},{"cell":"N11","colour":"Caramel","quantity":1,"size":null},{"cell":"Z11","colour":"Almond Green","quantity":1,"size":null},{"cell":"AH11","colour":"Gray","quantity":1,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B11","numeric_units":4,"pedigree_code":"LB-8710","price_cell":"AT11","raw_cells":{"AH11":{"style":"3","type":"n","value":"1"},"AS11":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"4"},"AT11":{"style":"4","type":"n","value":"23600"},"B11":null,"C11":{"style":"40","type":"n","value":"8710"},"D11":{"style":"3","type":"s","value":"LB-8710"},"E11":{"style":"3","type":"n","value":"1"},"N11":{"style":"3","type":"n","value":"1"},"Z11":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":11,"sheet":"CN Working Sheet","source_code":"8710","source_price":"23600","workbook_row_total":4}]},{"action":"create","allow_same_name":true,"base_price":23600,"category":"bag","category_id":null,"code":"LB-9283","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Almond Green","quantity":1,"sizes":[]},{"hex":"#808080","name":"Chestnut Brown","quantity":1,"sizes":[]},{"hex":"#808080","name":"Pottery Brown","quantity":0,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-9283-e3d005fe17f5","source_rows":[{"base_price_candidate":23600,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D12","colour":null,"customer_description":null,"inventory":[{"cell":"E12","colour":"Black","quantity":1,"size":null},{"cell":"Z12","colour":"Almond Green","quantity":1,"size":null},{"cell":"AF12","colour":"Chestnut Brown","quantity":1,"size":null},{"cell":"AG12","colour":"Pottery Brown","quantity":0,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B12","numeric_units":3,"pedigree_code":"LB-9283","price_cell":"AT12","raw_cells":{"AF12":{"style":"3","type":"n","value":"1"},"AG12":{"style":"3","type":"n","value":"0"},"AS12":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"3"},"AT12":{"style":"4","type":"n","value":"23600"},"B12":null,"C12":{"style":"40","type":"n","value":"9283"},"D12":{"style":"3","type":"s","value":"LB-9283"},"E12":{"style":"3","type":"n","value":"1"},"Z12":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":12,"sheet":"CN Working Sheet","source_code":"9283","source_price":"23600","workbook_row_total":3}]},{"action":"create","allow_same_name":true,"base_price":20950,"category":"bag","category_id":null,"code":"LB-369","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Khaki","quantity":2,"sizes":[]},{"hex":"#808080","name":"Caramel","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-369-333b443c5d19","source_rows":[{"base_price_candidate":20950,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D13","colour":null,"customer_description":null,"inventory":[{"cell":"E13","colour":"Black","quantity":1,"size":null},{"cell":"L13","colour":"Khaki","quantity":2,"size":null},{"cell":"N13","colour":"Caramel","quantity":1,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B13","numeric_units":4,"pedigree_code":"LB-369","price_cell":"AT13","raw_cells":{"AS13":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"4"},"AT13":{"style":"4","type":"n","value":"20950"},"B13":null,"C13":{"style":"40","type":"n","value":"369"},"D13":{"style":"3","type":"s","value":"LB-369"},"E13":{"style":"3","type":"n","value":"1"},"L13":{"style":"3","type":"n","value":"2"},"N13":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":13,"sheet":"CN Working Sheet","source_code":"369","source_price":"20950","workbook_row_total":4}]},{"action":"create","allow_same_name":true,"base_price":19900,"category":"bag","category_id":null,"code":"LB-6251","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Khaki","quantity":2,"sizes":[]},{"hex":"#808080","name":"Caramel","quantity":2,"sizes":[]},{"hex":"#808080","name":"Linen Blue","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-6251-8957f6814cea","source_rows":[{"base_price_candidate":19900,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D14","colour":null,"customer_description":null,"inventory":[{"cell":"E14","colour":"Black","quantity":1,"size":null},{"cell":"L14","colour":"Khaki","quantity":2,"size":null},{"cell":"N14","colour":"Caramel","quantity":2,"size":null},{"cell":"U14","colour":"Linen Blue","quantity":1,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B14","numeric_units":6,"pedigree_code":"LB-6251","price_cell":"AT14","raw_cells":{"AS14":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"6"},"AT14":{"style":"4","type":"n","value":"19900"},"B14":null,"C14":{"style":"40","type":"n","value":"6251"},"D14":{"style":"3","type":"s","value":"LB-6251"},"E14":{"style":"3","type":"n","value":"1"},"L14":{"style":"3","type":"n","value":"2"},"N14":{"style":"3","type":"n","value":"2"},"U14":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":14,"sheet":"CN Working Sheet","source_code":"6251","source_price":"19900","workbook_row_total":6}]},{"action":"create","allow_same_name":true,"base_price":19900,"category":"bag","category_id":null,"code":"LB-9337","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Not Named","size_system":null,"slug":"lb-9337-b03d9c3f4574","source_rows":[{"base_price_candidate":19900,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D15","colour":null,"customer_description":null,"inventory":[{"cell":"E15","colour":"Black","quantity":1,"size":null}],"issues":["missing_recorded_name"],"name_cell":"B15","numeric_units":1,"pedigree_code":"LB-9337","price_cell":"AT15","raw_cells":{"AS15":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"1"},"AT15":{"style":"4","type":"n","value":"19900"},"B15":null,"C15":{"style":"40","type":"n","value":"9337"},"D15":{"style":"3","type":"s","value":"LB-9337"},"E15":{"style":"3","type":"n","value":"1"}},"recorded_name":null,"review_cells":[],"row":15,"sheet":"CN Working Sheet","source_code":"9337","source_price":"19900","workbook_row_total":1}]},{"action":"create","allow_same_name":false,"base_price":39900,"category":"bag","category_id":null,"code":"LB-28KL","colours":[{"hex":"#808080","name":"Black","quantity":1,"sizes":[]},{"hex":"#808080","name":"Off White","quantity":1,"sizes":[]},{"hex":"#808080","name":"Khaki","quantity":1,"sizes":[]},{"hex":"#808080","name":"Caramel","quantity":1,"sizes":[]},{"hex":"#808080","name":"Elephant Gray","quantity":1,"sizes":[]}],"description":"Description of this product will be added later","evidence":"Item-push workbook mapping; blank names and swatches use documented placeholders.","name":"Hermes","size_system":null,"slug":"lb-28kl-f2d358c7900f","source_rows":[{"base_price_candidate":39900,"candidate_flags_for_new_products":{"active":false,"is_website_published":false,"publish_to_pos":false},"category_candidate":"bag","code_cell":"D16","colour":null,"customer_description":null,"inventory":[{"cell":"E16","colour":"Black","quantity":1,"size":null},{"cell":"J16","colour":"Off White","quantity":1,"size":null},{"cell":"L16","colour":"Khaki","quantity":1,"size":null},{"cell":"N16","colour":"Caramel","quantity":1,"size":null},{"cell":"AI16","colour":"Elephant Gray","quantity":1,"size":null}],"issues":[],"name_cell":"B16","numeric_units":5,"pedigree_code":"LB-28KL","price_cell":"AT16","raw_cells":{"AI16":{"style":"3","type":"n","value":"1"},"AS16":{"formula":null,"formula_attributes":{"si":"0","t":"shared"},"style":"5","type":"n","value":"5"},"AT16":{"style":"4","type":"n","value":"39900"},"B16":{"style":"3","type":"s","value":"Hermes"},"C16":{"style":"40","type":"s","value":"28KL"},"D16":{"style":"3","type":"s","value":"LB-28KL"},"E16":{"style":"3","type":"n","value":"1"},"J16":{"style":"3","type":"n","value":"1"},"L16":{"style":"3","type":"n","value":"1"},"N16":{"style":"3","type":"n","value":"1"}},"recorded_name":"Hermes","review_cells":[],"row":16,"sheet":"CN Working Sheet","source_code":"28KL","source_price":"39900","workbook_row_total":5}]}],"project_ref":"scvscxbxfpjqbqkfkset","workbook_sha256":"a299523b77936493abe5079d45a1687b6405ec75a4d0fcc3b0a832d54dc89aa5"}$opening_bags$;
  plan jsonb := approved_payload::jsonb;
  digest text := plan->>'workbook_sha256';
  batch_key text := encode(sha256(convert_to(approved_payload,'UTF8')),'hex');
  fingerprint text := encode(sha256(convert_to(plan::text,'UTF8')),'hex');
  category_uuid uuid;
  product_uuid uuid;
  colour_uuid uuid;
  app_uuid uuid;
  entry jsonb;
  colour jsonb;
  source jsonb;
  source_refs jsonb;
  audit_variants jsonb;
  colour_order integer;
  quantity integer;
  balance integer;
  delta_written integer;
  saved_delta integer;
  saved_balance integer;
  total_units integer := 0;
  has_product_projection boolean;
BEGIN
  IF approval_id IS DISTINCT FROM '700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5' OR batch_key IS DISTINCT FROM approval_id THEN
    RAISE EXCEPTION 'exact_batch_approval_required';
  END IF;

  -- Lock catalogue writes through the collision check and import. Existing
  -- products and colours are never updated by this script.
  LOCK TABLE public.products IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.excel_catalogue_batches b WHERE b.batch_id=batch_key) THEN
    IF NOT EXISTS (SELECT 1 FROM public.excel_catalogue_batches b WHERE b.batch_id=batch_key
        AND b.workbook_sha256=digest AND b.plan_digest=fingerprint)
       OR (SELECT count(*) FROM public.excel_catalogue_batch_audit a WHERE a.batch_id=batch_key AND a.outcome='IMPORTED') <> 11 THEN
      RAISE EXCEPTION 'existing_batch_requires_reconciliation';
    END IF;
    RAISE NOTICE 'Batch % already committed. Use its existing receipt.', batch_key;
    RETURN;
  END IF;

  SELECT id INTO STRICT category_uuid FROM public.categories
  WHERE slug='bags' AND parent_id IS NULL AND is_active FOR SHARE;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(plan->'products') e
    JOIN public.products p
    ON lower(regexp_replace(btrim(p.barcode),'[[:space:]]+','','g')) =
       lower(regexp_replace(btrim(e->>'code'),'[[:space:]]+','','g')) OR p.slug=e->>'slug'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(plan->'products') e
    CROSS JOIN LATERAL jsonb_array_elements(e->'source_rows') r
    JOIN public.excel_catalogue_imports l ON l.workbook_sha256=digest
      AND l.sheet_name=r->>'sheet' AND l.source_row=(r->>'row')::integer
  ) THEN
    RAISE EXCEPTION 'new_collision_or_existing_source_claim';
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.products'::regclass
    AND attname='stock_quantity' AND attnum>0 AND NOT attisdropped) INTO has_product_projection;
  IF has_product_projection AND NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.product_colors'::regclass
      AND t.tgfoid=to_regprocedure('public.pos_project_product_stock()')
      AND t.tgenabled IN ('O','A') AND (t.tgtype & 4) <> 0
  ) THEN
    RAISE EXCEPTION 'existing_product_stock_requires_insert_projection';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.products'::regclass
    AND attname='stock_tracking_mode' AND attnum>0 AND NOT attisdropped)
    AND NOT EXISTS (
      SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE a.attrelid='public.products'::regclass AND a.attname='stock_tracking_mode'
        AND pg_get_expr(d.adbin,d.adrelid) IN ('''color''::text', '''color''')
    ) THEN
    RAISE EXCEPTION 'existing_stock_mode_requires_colour_default';
  END IF;

  INSERT INTO public.excel_catalogue_batches(batch_id,workbook_sha256,plan_digest)
  VALUES (batch_key,digest,fingerprint);

  FOR entry IN SELECT value FROM jsonb_array_elements(plan->'products') LOOP
    app_uuid := gen_random_uuid();
    INSERT INTO public.products(name,slug,description,category,category_id,barcode,base_price,
                                active,is_website_published,publish_to_pos)
    VALUES (entry->>'name',entry->>'slug',entry->>'description','bag',category_uuid,entry->>'code',
            (entry->>'base_price')::integer,false,false,false)
    RETURNING id INTO product_uuid;

    colour_order := 0;
    audit_variants := '[]'::jsonb;
    FOR colour IN SELECT value FROM jsonb_array_elements(entry->'colours') LOOP
      quantity := (colour->>'quantity')::integer;
      INSERT INTO public.product_colors(product_id,color_name,color_hex,sort_order,stock_quantity)
      VALUES (product_uuid,colour->>'name',colour->>'hex',colour_order,quantity)
      RETURNING id,stock_quantity INTO colour_uuid,balance;

      delta_written := 0;
      IF quantity > 0 THEN
        INSERT INTO public.stock_movements(product_id,color_id,delta,quantity_after,reason,reference_uuid)
        VALUES (product_uuid,colour_uuid,quantity,balance,'excel_catalogue_import',app_uuid)
        RETURNING delta,quantity_after INTO saved_delta,saved_balance;
        IF saved_delta IS DISTINCT FROM quantity OR saved_balance IS DISTINCT FROM balance THEN
          RAISE EXCEPTION 'opening_movement_mismatch';
        END IF;
        delta_written := saved_delta;
      END IF;
      IF balance IS DISTINCT FROM quantity THEN RAISE EXCEPTION 'opening_balance_mismatch'; END IF;

      audit_variants := audit_variants || jsonb_build_array(jsonb_build_object(
        'color_id',colour_uuid,'colour',colour->>'name','size_id',null,'size_system',null,'size_label',null,
        'approved_quantity',quantity,'approved_delta',quantity,
        'committed_quantity',balance,'stock_quantity_applied',delta_written
      ));
      total_units := total_units + quantity;
      colour_order := colour_order + 1;
    END LOOP;

    IF has_product_projection THEN
      EXECUTE 'SELECT stock_quantity FROM public.products WHERE id=$1' INTO balance USING product_uuid;
      IF balance IS DISTINCT FROM (
        SELECT sum(c.stock_quantity) FROM public.product_colors c WHERE c.product_id=product_uuid
      ) THEN RAISE EXCEPTION 'opening_product_projection_mismatch'; END IF;
    END IF;

    SELECT jsonb_agg(jsonb_build_object('sheet',s->>'sheet','row',(s->>'row')::integer))
    INTO source_refs FROM jsonb_array_elements(entry->'source_rows') s;
    INSERT INTO public.excel_catalogue_batch_audit
      (batch_id,application_id,product_id,product_code,source_rows,action,outcome,variants)
    VALUES (batch_key,app_uuid,product_uuid,entry->>'code',source_refs,'create','IMPORTED',audit_variants);

    FOR source IN SELECT value FROM jsonb_array_elements(entry->'source_rows') LOOP
      INSERT INTO public.excel_catalogue_imports
        (workbook_sha256,sheet_name,source_row,product_id,approved_product,application_id)
      VALUES (digest,source->>'sheet',(source->>'row')::integer,product_uuid,entry,app_uuid);
    END LOOP;
  END LOOP;

  IF total_units <> 54 THEN RAISE EXCEPTION 'unexpected_opening_units'; END IF;
END;
$approved_import$;

COMMIT;
