-- Read-only inspection for a separately verified staging database.
begin read only;

select current_database(), current_setting('server_version');

select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('products', 'categories', 'product_colors', 'product_images',
                     'orders', 'order_items', 'pos_sale_items', 'pos_return_items',
                     'stock_movements', 'pos_stock_adjustments')
order by table_name, ordinal_position;

select c.conrelid::regclass as relation, c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
  and (r.relname in ('products', 'categories', 'product_colors', 'product_images',
                    'order_items', 'pos_sale_items', 'pos_return_items',
                    'stock_movements', 'pos_stock_adjustments')
       or c.confrelid in (to_regclass('public.products'), to_regclass('public.product_colors')))
order by c.conrelid::regclass::text, c.conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('products', 'product_colors')
order by tablename, indexname;

select t.tgrelid::regclass as relation, pg_get_triggerdef(t.oid) as trigger_definition,
       pg_get_functiondef(t.tgfoid) as function_definition
from pg_trigger t
join pg_class r on r.oid = t.tgrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by r.relname, t.tgname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname ~ '(stock|catalogue|product|sale|order|return|checkout)'
order by p.proname, arguments;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('products', 'product_colors', 'product_images', 'categories')
order by tablename, policyname;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('products', 'product_colors')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, column_name, grantee, privilege_type;

rollback;
