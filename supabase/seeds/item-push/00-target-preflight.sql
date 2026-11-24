-- Run only on the independently verified new project. No importer/RPC calls.
\set ON_ERROR_STOP on
BEGIN READ ONLY;

WITH required(rel, cols) AS (VALUES
  ('products', 'id,barcode,name,slug,description,category,category_id,base_price,active,is_website_published,publish_to_pos,stock_tracking_mode,stock_quantity'),
  ('categories', 'id,slug,parent_id,is_active'),
  ('product_colors', 'id,product_id,color_name,color_hex,sort_order,stock_quantity'),
  ('product_color_sizes', 'id,color_id,size_system,size_label,stock_quantity,archived'),
  ('product_images', 'id,color_id,angle,image_url,sort_order'),
  ('stock_movements', 'product_id,color_id,size_id,size_system,size_label,delta,quantity_after,reason,reference_uuid'),
  ('excel_catalogue_imports', 'workbook_sha256,sheet_name,source_row,product_id,approved_product,application_id,applied_at'),
  ('excel_catalogue_batches', 'batch_id,workbook_sha256,plan_digest,recorded_at'),
  ('excel_catalogue_batch_audit', 'batch_id,application_id,product_id,product_code,source_rows,action,outcome,variants,recorded_at')
)
SELECT r.rel, col AS required_column, a.attname IS NOT NULL AS present
FROM required r CROSS JOIN LATERAL unnest(string_to_array(r.cols, ',')) AS u(col)
LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('public.' || r.rel)
  AND a.attname=col AND a.attnum>0 AND NOT a.attisdropped
ORDER BY r.rel, col;

SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_migration_ledger \gset
\if :has_migration_ledger
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
\endif

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
  'products','categories','product_colors','product_color_sizes','product_images',
  'stock_movements','excel_catalogue_imports','excel_catalogue_batches','excel_catalogue_batch_audit'
) ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN (
  'products','categories','product_colors','product_color_sizes','product_images',
  'stock_movements','excel_catalogue_imports','excel_catalogue_batches','excel_catalogue_batch_audit'
) ORDER BY tablename, policyname;

SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN (
  to_regclass('public.products'), to_regclass('public.product_colors'),
  to_regclass('public.product_color_sizes'), to_regclass('public.stock_movements')
) ORDER BY t.tgrelid::regclass::text, t.tgname;

SELECT c.conrelid::regclass AS relation, c.conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c WHERE c.conrelid IN (
  to_regclass('public.products'), to_regclass('public.categories'), to_regclass('public.product_colors'),
  to_regclass('public.product_color_sizes'), to_regclass('public.excel_catalogue_imports'),
  to_regclass('public.excel_catalogue_batches'), to_regclass('public.excel_catalogue_batch_audit')
) ORDER BY c.conrelid::regclass::text,c.conname;

SELECT p.oid::regprocedure AS routine, p.prosecdef AS security_definer,
       has_function_privilege(current_user,p.oid,'EXECUTE') AS connected_role_can_execute
FROM pg_proc p WHERE p.oid IN (
  to_regprocedure('public.apply_excel_catalogue(jsonb)'),
  to_regprocedure('public.catalogue_import_set_stock(uuid,uuid,uuid,integer,uuid)'),
  to_regprocedure('public.catalogue_import_variant_audit(jsonb,uuid,uuid)'),
  to_regprocedure('public.pos_change_variant_stock(uuid,uuid,uuid,integer,boolean)')
);

SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='products' ORDER BY indexname;

-- Check candidate collisions only when the root lookup and match columns exist.
SELECT (
  SELECT count(*)=8 FROM information_schema.columns WHERE table_schema='public'
    AND ((table_name='categories' AND column_name IN ('id','slug','parent_id','is_active'))
      OR (table_name='products' AND column_name IN ('id','barcode','name','slug')))
) AS has_match_schema \gset
\if :has_match_schema
SELECT slug,id FROM public.categories
WHERE slug IN ('bags','shoes','belts') AND parent_id IS NULL AND is_active ORDER BY slug;


WITH candidates AS (
  SELECT * FROM jsonb_to_recordset($preflight$[{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-532","slug":"lb-532-bdd6bd6e8b94","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-5569","slug":"lb-5569-6ef8bcc0d966","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-6867","slug":"lb-6867-2a9c3d596967","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-2419","slug":"lb-2419-9339dcd69079","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-8931","slug":"lb-8931-90854a965ad7","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-9343","slug":"lb-9343-f4eb6683fb56","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-8710","slug":"lb-8710-8a9236a31991","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-9283","slug":"lb-9283-e3d005fe17f5","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-369","slug":"lb-369-333b443c5d19","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-6251","slug":"lb-6251-8957f6814cea","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-9337","slug":"lb-9337-b03d9c3f4574","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"02-cn-bags-a.sql","position":1,"code":"LB-28KL","slug":"lb-28kl-f2d358c7900f","name":"Hermes","category_slug":"bags","allow_same_name":false},{"batch":"04-cn-shoes-b.sql","position":2,"code":"SS-6008","slug":"ss-6008-428b3a735bb5","name":"China Sport","category_slug":"shoes","allow_same_name":false},{"batch":"04-cn-shoes-b.sql","position":2,"code":"SS- SC","slug":"ss-sc-616e40f1008c","name":"Stark Comfort","category_slug":"shoes","allow_same_name":false},{"batch":"04-cn-shoes-b.sql","position":2,"code":"SS-DC","slug":"ss-dc-b03f14a2b1f7","name":"Dream Comfort","category_slug":"shoes","allow_same_name":false},{"batch":"04-cn-shoes-b.sql","position":2,"code":"LSS- 6H061","slug":"lss-6h061-2766a10da940","name":"New York Tide Boots","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"SS-8808","slug":"ss-8808-3a7ee36b83a9","name":"Buchinu 8808","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"SS-G107","slug":"ss-g107-36fa6f885966","name":"G107- Puma","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"SS-aLa","slug":"ss-ala-fab2cc4af26e","name":"Vic Nicole (aLa)","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"LSS-598P7","slug":"lss-598p7-0769d4ecdc6a","name":"Helmer","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"LSS-33F","slug":"lss-33f-cf01ca1dea1e","name":"Fashion 33","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"SS-Rmx33","slug":"ss-rmx33-7507cf952b7a","name":"Remxus","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"OLS-JN","slug":"ols-jn-87ee02ff8529","name":"JUN- Official Leather Shoes","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"OLS-WB","slug":"ols-wb-147c7b9f6fc9","name":"Waterbuck Official Leather Shoes","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"OLS-LKSD","slug":"ols-lksd-111a918016fc","name":"LK-SD- Official Leather Shoes","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"OLS- SS","slug":"ols-ss-68b59e086f43","name":"Silvetone Spider- Official Leather Shoes","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"OLS-CL","slug":"ols-cl-c16fc5c0116c","name":"Clarks- Official Leather Shoes","category_slug":"shoes","allow_same_name":false},{"batch":"03-cn-shoes-a.sql","position":3,"code":"LSS-33Pop","slug":"lss-33pop-ee1993289ca4","name":"Herilios Ezogeuo","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"JY75805BX01","slug":"jy75805bx01-0a8a66803ae9","name":"JY75805BX01","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"H13857JH01","slug":"h13857jh01-07e389267bc9","name":"H13857JH01","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"GA385A93-3","slug":"ga385a93-3-bc2d092a7caa","name":"GA385A93-3","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"FA53324-1","slug":"fa53324-1-63bde0053b9a","name":"FA53324-1","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"K599-6A","slug":"k599-6a-493d346647b3","name":"K599-6A","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"SF1750-01A","slug":"sf1750-01a-44c601bae635","name":"SF1750-01A","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"S213-5","slug":"s213-5-927bb71f25e9","name":"S213-5","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"S213-3","slug":"s213-3-475585ddb089","name":"S213-3","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"JL55860JH01","slug":"jl55860jh01-23651ec2a522","name":"JL55860JH01","category_slug":"shoes","allow_same_name":false},{"batch":"08-cn-broadway-shoes.sql","position":4,"code":"JL55860BX01","slug":"jl55860bx01-f18486b06ae5","name":"JL55860BX01","category_slug":"shoes","allow_same_name":false},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-1028","slug":"lb-1028-dc555bf35477","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-55-802","slug":"lb-55-802-334800eff21b","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-9079","slug":"lb-9079-8ce7c03cba9c","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-3217","slug":"lb-3217-633cb1938802","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-J-033","slug":"lb-j-033-f9406a30054f","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-920","slug":"lb-920-b6cc0179b9c7","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-9062","slug":"lb-9062-4e7631030d62","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-6663","slug":"lb-6663-18cf45542852","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-6739","slug":"lb-6739-b9a28ed4fb6b","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-5097","slug":"lb-5097-cd0b74aa46c5","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8035","slug":"lb-8035-fd3292b9e187","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-6656","slug":"lb-6656-0810c7b6b1c7","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8255","slug":"lb-8255-2fc733c66b25","name":"BVLGARI","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8256","slug":"lb-8256-1fa4b0277583","name":"BVLGARI","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8257","slug":"lb-8257-6170c2d7f73b","name":"Crocodile","category_slug":"bags","allow_same_name":false},{"batch":"05-cn-bags-b.sql","position":5,"code":"CLB-A25","slug":"clb-a25-d68acbc29860","name":"Custom made Platinum- A25","category_slug":"bags","allow_same_name":false},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8716","slug":"lb-8716-575c21f4f98d","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-23018","slug":"lb-23018-296beb92d63c","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8002","slug":"lb-8002-129887608a11","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-9701","slug":"lb-9701-ffa1687e3e95","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-A122","slug":"lb-a122-6c0af45d7f45","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-6832","slug":"lb-6832-83d95750ea8e","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-3808","slug":"lb-3808-17990e8ca8e6","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-A066","slug":"lb-a066-03ab3af8a81d","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-A078","slug":"lb-a078-b518a7911ec0","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8922","slug":"lb-8922-3bfcd6cce36a","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-5232","slug":"lb-5232-5ba645c3b03f","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-5182","slug":"lb-5182-909b16d6c52d","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8700","slug":"lb-8700-bf26dbe312e4","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8800","slug":"lb-8800-7d6006ef98d7","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8182","slug":"lb-8182-2653e464da91","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-5561","slug":"lb-5561-e618eb7d9c60","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-2207","slug":"lb-2207-e9ffc7301b08","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-288","slug":"lb-288-81e4f9c85f5a","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-266","slug":"lb-266-4f3ef829e332","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-3036","slug":"lb-3036-820aa885fb87","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8008","slug":"lb-8008-c7f8088e5bd8","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-A090","slug":"lb-a090-45ba6a8135ce","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8620","slug":"lb-8620-3be4a6428910","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-88-218","slug":"lb-88-218-0de21f1108ce","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8568","slug":"lb-8568-3c2b5ca56d99","name":"Not Named","category_slug":"bags","allow_same_name":true},{"batch":"05-cn-bags-b.sql","position":5,"code":"LB-8569","slug":"lb-8569-4f12809c0a19","name":"Not Named","category_slug":"bags","allow_same_name":true}]$preflight$::jsonb)
    AS x(batch text, position int, code text, slug text, name text, category_slug text, allow_same_name boolean)
), checks AS (
  SELECT x.*,
    NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.slug=x.category_slug AND c.parent_id IS NULL AND c.is_active) AS missing_root,
    EXISTS (SELECT 1 FROM public.products p WHERE lower(btrim(p.barcode))=lower(btrim(x.code))) AS code_match,
    EXISTS (SELECT 1 FROM public.products p WHERE p.slug=x.slug) AS slug_match,
    NOT x.allow_same_name AND EXISTS (
      SELECT 1 FROM public.products p WHERE lower(btrim(p.name))=lower(btrim(x.name))
    ) AS blocked_name_match
  FROM candidates x
)
SELECT batch, count(*) AS candidate_products,
  count(*) FILTER (WHERE missing_root) AS missing_root_products,
  count(*) FILTER (WHERE code_match) AS existing_code_matches,
  count(*) FILTER (WHERE slug_match) AS existing_slug_matches,
  count(*) FILTER (WHERE blocked_name_match) AS blocked_name_matches,
  array_agg(code ORDER BY code) FILTER (WHERE
    missing_root OR code_match OR slug_match OR blocked_name_match) AS review_codes
FROM checks GROUP BY position,batch ORDER BY position;
\endif

ROLLBACK;
