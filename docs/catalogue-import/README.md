# Shared catalogue import preparation

[Workbook preview](preview.json) contains the source cells, sheet and row references, parsed inventory, code groups, review issues and draft product candidates for the actual workbook. The preview records the workbook SHA-256. The XLSX remains the original record for Excel formatting, images and other workbook metadata.

## Reconciliation

| Section | Candidate category | Source rows | Numeric units |
| --- | --- | ---: | ---: |
| VN 4–39 | Bags, pending confirmation | 36 | Unknown |
| CN 5–16 | Bags | 12 | 59 |
| CN 19–36 | Shoes by size | 18 | 70 |
| CN 39–56 | Shoes by size | 18 | 88 |
| CN 59–101 | Bags | 43 | 351 |
| CN 104 | Belt | 1 | Unknown |
| CN 107–109 | Shoes by colour | 3 | 30 |
| CN 112–122 | Shoes by size | 11 | 170 |
| **Total** | | **142** | **768** |

The 768 is a sum of recorded numeric quantities across 351 populated inventory cells, including 20 explicit zeroes and excluding one invalid cell. It is a workbook reconciliation total. Bag colour quantities reconcile to 59 and 351, and the second section's 351 agrees with cached subtotal AS102. Sized sections contribute 328 numeric units, including units on rows with unresolved identity or colour. Blank cells carry no quantity assertion. CN row 77 has a cached zero total and no colour counts. VN has prices and codes without colour or quantity fields.

The 110 distinct coded candidates include 89 requiring source review and 21 with draft field proposals awaiting staging matching and catalogue validation. Twelve uncoded rows are held separately. The [execution preview](execution-preview.json) proposes **0 creates, 0 links, 0 stock reconciliations and 0 import-ready products**. All 142 rows are held pending a reviewed manifest. The 21 candidates have usable source fields and still need staging matches and approved metadata.

## Source decisions

| Issue | Source evidence and decision needed |
| --- | --- |
| Explicit code reuse | VN repeats PH 2102, PH 2329, PH 2303, PH 2126, PH 2251, PH 2692, PH-W 6229, PH 2330, PH 2691 and PH 2503 across 23 rows. Confirm which names denote colourways, duplicate source entries or distinct products needing a separate identity. Seven CN groups share a code through an Excel merge, which provides evidence to group those colour rows. |
| Uncoded shoes | CN 39–43 and 44–50 record ON Cloud Tilt and ON Cloud Surf X4 with different colours but blank Pedigree codes. Confirm the model grouping and assign or match approved codes. |
| Prices | VN D4 is blank. VN D19 is explicitly zero, while D16–D18 are 11,350 for the same code. CN AT77 has fractional 19401.568627450983. Confirm prices and currency before mapping the VAT-inclusive source price to whole-KES `base_price`. Cached selling prices are preserved for review. |
| Footwear variants | CN C22 lacks a colour for SS-AM4140. CN L26 has `]` at size 41 for the White LSS-99051 row. CN 107–109 has 30 units split between Brown and Light Brown with no sizes. Confirm sizing system and values before allocating stock. |
| Names, descriptions and photos | 54 rows lack a recorded name and 11 repeat the code as the name. The workbook has no dedicated customer description field. Keep recorded labels, supplier codes and quantities as internal source data. Keep the draft description empty until approved copy is supplied from verified attributes. No generated materials, product subtypes, swatch hexes, or image rows are proposed. |
| Belt | CN 104 under Lihua Belts records LSS-2125 and 14,200 with no recorded name, colour or quantity. Confirm its details and route/type support. |
| Category mapping | Section context supplies the bag/shoe/belt candidates. Confirm VN and the CN blocks without explicit category labels, and resolve each final category against the staging category tree. |

## Checked-in database contract

- `products.id` is shared identity. `slug` is unique, `base_price` is an integer, and `description` defaults to an empty string. The legacy `category` check accepts `bag` or `shoe`. Merchandising uses `category_id` referencing `categories`. Migration 024 adds the partial unique barcode index and separate website and POS flags. The barcode index compares exact text, so the importer must surface case/spacing collisions in its comparison. [Initial schema](../../supabase/migrations/001_initial.sql), [categories reconciliation](../../supabase/migrations/021_categories_reconcile.sql), [shared flags](../../supabase/migrations/024_product_pos_and_currency.sql).
- `product_colors` stores a required hex, stable colour UUID and colour-level stock. Photos hang off colour UUIDs and the storefront renders placeholders without image rows. The website now reads size rows for size-tracked products and derives availability from their sum. [Colour stock](../../supabase/migrations/022_color_stock.sql), [domain types](../../lib/types.ts), [generated types](../../lib/supabase/types.ts), [image fallback](../../components/product/ProductImage.tsx).
- Storefront migration 022 drops product-level stock. POS migration `20261116100000_pos_sale_rpc.sql` adds it again and attaches `pos_project_product_stock` to colour inserts, deletes and stock/product changes. It projects deltas to the product aggregate. POS publishing migration `20261117120000_pos_product_publishing.sql` installs `pos_stock_adjustment_audit` on stock adjustment records. POS sale, payment snapshot, return and adjustment paths identify sized stock by colour and size UUID, with movement and sale history in the POS schema. Inspect their deployed definitions and actual migration order in staging before writing. [Shared contract](../POS_CATALOGUE_COMPATIBILITY.md), [staging audit SQL](../sql/catalogue-import-staging-audit.sql).
- The replacement website checkout RPC validates publication, price and variant under locks, then saves the order and reserves stock in one transaction. A replay with the same request UUID returns the existing order. [Website checkout](../../lib/orders-api.ts).

The checked-in SQL and application types were inspected in both repositories. No verified staging database connection was available. Actual database constraints, triggers, grants, live migration ledger and existing product matches remain unverified. The included SQL is read-only and intended for a separately verified staging connection. Inspect the staging migration ledger as well when `supabase_migrations.schema_migrations` exists.

## Proposed migration order

1. Verify the shared staging schema, migration ledger and roles using the [staging audit](../sql/catalogue-import-staging-audit.sql). Confirm publication columns, order zone and status fields, anonymous grants, the category constraint name, the POS colour-to-product trigger, and case or spacing collisions in existing codes.
2. Review the canonical POS migration at ../posversion2/supabase/migrations/20261118130000_pos_size_inventory.sql. It owns the stock tracking mode, size table, archive and projection rules, and private stock writer.
3. Review the [website edit RPC](../sql/website-edit-product.review.sql) and the [website checkout SQL](../sql/catalogue-sized-stock.review.sql) after the POS prerequisite. Edit snapshots reject concurrent stock-mode conversions and tolerate stock count changes. Website SQL adds order history and the checkout writer. The current POS catalogue migration includes belt support with colour-level stock. Then install the [website cancellation SQL](../sql/website-cancel-order.review.sql) before switching the website cancellation action. Install the private SKU grant migration in its coordinated release after consumers use explicit public projections.
4. Review the [import ledger and transaction SQL](../sql/catalogue-excel-import.review.sql). Resolve normalized code collisions before adding the unique index. Match the approved manifest against staging, then generate the SQL artifact for a separately authorized import session.
5. Roll out the website against the new shared schema and refreshed PostgREST cache. The checkout RPC and public projection must exist before the website switches over. Verify publication, anonymous grants, cart price rounding, delivery totals and payment initiation on staging.
6. Verify the current POS and website clients together before enabling sized publication. Sized shoes have independent POS and website publication flags. Keep the private SKU grant migration in its own release.

## Import workflow

The [review manifest](review-manifest.json) is tied to the workbook digest. Each reviewed product entry requires:

- Source row pairs, action, code, name, URL slug, category discriminator, staging category UUID, and confirmed KES price.
- Approved colour names, swatch hexes and quantities. Shoes require an approved sizing system and size labels with quantities. Explicit zeroes remain valid. Blanks require follow-up before becoming quantities.
- The destination UUID for a link or reconciliation. Reconciliation also requires a time-zone-qualified stock cutoff, evidence and each expected pre-import quantity. Include evidence for disputed rows, changed source fields or deliberately shared names. Record customer descriptions separately and leave inactive drafts empty until copy is approved.

Keep a reason for each withheld member of a code group when importing another member. The compiler verifies workbook digest, duplicate identities, group coverage, price and inventory fields and retains raw source cells with the approved values. Generate previews without credentials:

~~~sh
python scripts/catalogue_import_preview.py \
  '../Pedigree Images/Pedigree Updated Stock Sheet Shared Copy.xlsx' \
  docs/catalogue-import/preview.json

python scripts/catalogue_bulk_import.py \
  '../Pedigree Images/Pedigree Updated Stock Sheet Shared Copy.xlsx' \
  docs/catalogue-import/review-manifest.json \
  docs/catalogue-import/execution-preview.json
~~~

Pass --sql-out PATH to produce a SQL artifact for an approved, nonempty plan. The compiler opens no database connection.

| Action | Database effect |
| --- | --- |
| create | Reject a possible code, slug or name collision. Create one inactive, unpublished product and initialize its stock. Create no image rows. |
| link | Check the product UUID, matching catalogue fields and the full variant identities and balances. Record source provenance and fill an empty code if approved. |
| reconcile | Verify each expected balance under locks, then replace balances with approved cutoff quantities in the same transaction. Keep catalogue UUIDs and history. Record the approved before and after values in the import ledger. |

The transaction serializes source claims. Replaying the same payload returns the prior outcome without resetting stock after sales or manual adjustments. A changed payload for claimed workbook rows aborts. A new workbook digest still requires collision checks and reviewed matching. Existing variant mismatches or archived sizes on a matched product abort the plan. Colour-level shoes require explicit conversion before sized reconciliation. Each delta references the same application UUID as its source observations. Count reconciliation requires a verified cutoff that accounts for intervening sales, returns and adjustments.

## Verification

- Eight isolated workbook/compiler tests and the Node catalogue, cart and image tests passed. The source workbook preview reproduced exactly.
- PostgreSQL 17 fixtures verified bag, shoe and belt creation, existing links, reconciliation, stale-balance rejection, replay after checkout or later stock adjustment, stock projection, atomic checkout rollback and last-unit refusal. The website edit fixture exercised preservation of colour IDs, photos, stock and POS history references. The PostgreSQL run used a standalone backend because the sandbox blocks listening sockets. The public query projection omits internal codes. Database SKU grants are reviewed in their separate release. Server-mode RLS row visibility and simultaneous checkout/edit races remain staging checks.
- TypeScript passed and lint reported zero errors and 12 existing warnings. An isolated Webpack production build passed with fixture fonts, an isolated Supabase configuration and Next’s TypeScript compiler API. The normal build and a separate seeded prerender attempt did not complete in the sandbox.
- No production or staging Supabase was contacted. No live import, migration, deployment or push was performed.

Staging acceptance also needs checkout and POS payment, returns and stock adjustment integration, browser checks with genuine images, cross-app cache invalidation, and the operational release of stock from unpaid or cancelled orders.
