-- Read-only catalogue contract check for the 11-bag import. No barcode matching.
BEGIN READ ONLY;
SELECT object_name, to_regclass('public.'||object_name) AS deployed
FROM (VALUES ('products'),('categories'),('product_colors'),('stock_movements'),
  ('excel_catalogue_imports'),('excel_catalogue_batches'),('excel_catalogue_batch_audit')) t(object_name);

SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public' AND table_name IN
('products','categories','product_colors','stock_movements',
 'excel_catalogue_imports','excel_catalogue_batches','excel_catalogue_batch_audit')
ORDER BY table_name,ordinal_position;

SELECT t.tgname,t.tgenabled,t.tgfoid::regprocedure AS function,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t WHERE NOT t.tgisinternal
  AND t.tgrelid IN (to_regclass('public.product_colors'),to_regclass('public.stock_movements'));

SELECT c.conrelid::regclass AS relation,c.conname,pg_get_constraintdef(c.oid)
FROM pg_constraint c WHERE c.conrelid IN (
  to_regclass('public.products'),to_regclass('public.product_colors'),to_regclass('public.stock_movements'),
  to_regclass('public.excel_catalogue_imports'),to_regclass('public.excel_catalogue_batches'),
  to_regclass('public.excel_catalogue_batch_audit'));

SELECT slug,id FROM public.categories WHERE slug='bags' AND parent_id IS NULL AND is_active;
ROLLBACK;
