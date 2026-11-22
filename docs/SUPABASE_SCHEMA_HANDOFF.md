# Supabase schema handoff for Claude

Pedigree Leather's website and POS 2.0 share one catalogue and inventory model. The website repository is `Pedigree-leather` and the sibling POS repository is `../posversion2`. Use the SQL below to trace where a column is created, changed, or dropped. The TypeScript definitions describe the website's expected interface.

## Website schema sources

| Tables or columns | SQL source | Notes |
| --- | --- | --- |
| `products`, `product_colors`, `product_images` | [001_initial.sql](../supabase/migrations/001_initial.sql) | Base catalogue. Product UUIDs are shared across apps. Colours belong to products and images belong to colours. The initial product-level stock column changes later. |
| `categories`, `products.category_id` | [012_categories.sql](../supabase/migrations/012_categories.sql), [021_categories_reconcile.sql](../supabase/migrations/021_categories_reconcile.sql) | `category_id` references the dynamic category tree. The separate `products.category` discriminator drives catalogue behaviour and routes. |
| `product_colors.stock_quantity` | [022_color_stock.sql](../supabase/migrations/022_color_stock.sql) | Moves stock to colours and drops the original product-level column. POS later adds a projected product total. |
| `products.base_price_usd`, `barcode`, publication flags | [010_usd_pricing.sql](../supabase/migrations/010_usd_pricing.sql), [024_product_pos_and_currency.sql](../supabase/migrations/024_product_pos_and_currency.sql) | Shared POS migrations also touch some of these columns. `is_website_published` and `publish_to_pos` are independent. Verify deployed defaults from PostgreSQL. |
| `orders`, `order_items` and order history | [003_orders.sql](../supabase/migrations/003_orders.sql), [006_order_status.sql](../supabase/migrations/006_order_status.sql), [009_delivery_zones.sql](../supabase/migrations/009_delivery_zones.sql) | Consult the later migrations for status, history and delivery fields. |
| Website payment fields and status constraints | [013_mpesa_payments.sql](../supabase/migrations/013_mpesa_payments.sql), [014_manual_mpesa.sql](../supabase/migrations/014_manual_mpesa.sql) | Keep provider attempt references separate from the website checkout request ID. |
| Shop settings, admin users and legal pages | [008 shop settings](../supabase/migrations/008_shop_settings.sql), [011 social settings](../supabase/migrations/011_shop_settings_socials.sql), [024 exchange rate](../supabase/migrations/024_product_pos_and_currency.sql), [007 admin users](../supabase/migrations/007_admin_users.sql), [023 legal pages](../supabase/migrations/023_legal_pages.sql) | Support tables for the website. |
| Product image storage | [002_storage.sql](../supabase/migrations/002_storage.sql) | Bucket and object policies. Image URLs and associations are stored in the catalogue. Check deployed Storage permissions separately. |

## Shared POS schema

- [POS sale and stock projection migration](../../posversion2/supabase/migrations/20261116100000_pos_sale_rpc.sql) reintroduces `products.stock_quantity` as an aggregate of colour stock. Website migration 022 must precede this projection in a fresh shared build.
- [POS private product codes](../../posversion2/supabase/migrations/20261118110000_pos_private_product_codes.sql) narrows product read grants. Use explicit public projections in [lib/api.ts](../lib/api.ts) so the storefront omits `barcode`.
- [POS catalogue and multi-image migration](../../posversion2/supabase/migrations/20261118120000_pos_catalogue_multi_image.sql) defines the manager catalogue writer. The current source accepts bags, shoes and belts. Belts use colour-level stock.
- [POS size inventory migration](../../posversion2/supabase/migrations/20261118130000_pos_size_inventory.sql) owns `products.stock_tracking_mode`, `product_color_sizes`, the size-to-colour projection and `pos_change_variant_stock`. Size rows carry `color_id`, `size_system`, `size_label`, `stock_quantity` and `archived`. Write stock through the shared writer, record the movement in the same transaction, and let the triggers maintain the totals. Keep colour and size UUIDs stable for history.

## Website SQL awaiting deployment verification

Files under `docs/sql/` are review scripts outside the website migration directory. Their presence in source does not establish that they were applied.

| Review script | What it adds |
| --- | --- |
| [Website product editing](sql/website-edit-product.review.sql) | The edit RPC retains colour IDs and image associations and preserves stock. |
| [Website checkout](sql/catalogue-sized-stock.review.sql) | Website order request fields, order-item colour and size references and size snapshots, and an atomic checkout RPC using the POS stock writer. |
| [Website cancellation](sql/website-cancel-order.review.sql) | Cancels eligible orders, reverses committed reservation movements once and preserves payment records. |
| [Excel import](sql/catalogue-excel-import.review.sql) | The import ledger and an idempotent writer for approved batches. |

## Where to verify

- [Website Supabase types](../lib/supabase/types.ts) and [row mappers](../lib/mappers.ts) show how application code reads the schema.
- [Migration order and import contract](catalogue-import/README.md) and [release verification](catalogue-import/RELEASE_VERIFICATION.md) record dependencies and outstanding tests.
- Use the [read-only staging audit SQL](sql/catalogue-import-staging-audit.sql) on a verified staging database to inspect columns, defaults, constraints, indexes, triggers, functions, grants and RLS. Compare its output with the staging migration ledger before documenting a field as deployed.

## Instructions for the receiving agent

Identify the exact table and column in SQL before proposing a change. Search both repositories for subsequent ALTER statements, triggers and callers, since an initial definition may no longer describe the shared schema. Distinguish checked-in definitions, review SQL and deployed facts in your findings. Use disposable fixtures or explicitly isolated staging for tests. Do not apply migrations, write to production, import real stock, push or deploy from this handoff.
