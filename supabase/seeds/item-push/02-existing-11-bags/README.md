# Eleven new bags for the existing Supabase project

Destination: **scvscxbxfpjqbqkfkset**. Scope comes from the supplied live matching result. Eleven codes are new candidates. LB-532 is excluded and retains its historical product and colour UUIDs, stock and references. The original candidate seed is unchanged.

| Code | Name | KES | Opening units |
| --- | --- | ---: | ---: |
| LB-5569 | Not Named | 12,550 | 2 |
| LB-6867 | Not Named | 20,350 | 6 |
| LB-2419 | Not Named | 22,400 | 7 |
| LB-8931 | Not Named | 18,400 | 6 |
| LB-9343 | Not Named | 23,600 | 10 |
| LB-8710 | Not Named | 23,600 | 4 |
| LB-9283 | Not Named | 23,600 | 3 |
| LB-369 | Not Named | 20,950 | 4 |
| LB-6251 | Not Named | 19,900 | 6 |
| LB-9337 | Not Named | 19,900 | 1 |
| LB-28KL | Hermes | 39,900 | 5 |
| **Total** | **11 new products** | | **54** |

The transactional SQL embeds exact workbook colour names and balances from the checked-in seed, including explicit zeroes. Drafts use the agreed description, active top-level Bags category, neutral display swatches and no image rows. All three publication flags are false.

## Required schema for this batch

- Reuse existing products, categories, product_colors and stock_movements. Require one active, top-level Bags row. Reuse catalogue UUID defaults, product/colour foreign keys, the product slug key, and the colour key on product plus colour name.
- The only conditional additions are the canonical import row-claim, batch and variant-audit tables with their primary keys and the unique imported-application index on a newly created audit table. Also add the canonical nullable stock_movements.reference_uuid column only if absent. The script leaves existing ledger objects in place and stops if their required structure is incompatible. The current live presence of these objects has not been supplied.
- No new function is required. This create-only transaction sets colour stock at INSERT and records matching movements and receipts in the same transaction. If the existing schema has the POS product-stock aggregate, the existing canonical product-stock projection must be enabled for colour inserts. The script checks that dependency and verifies the imported totals. The script does not backfill or repair older stock. If core catalogue or movement tables are absent, or the projection check fails, stop for a separate review of the missing canonical dependency.
- The bag path uses neither product_color_sizes nor the shared sized-stock writer. It does not need the generic Excel RPC, a new global normalized barcode index, shoe migrations, or POS feature changes. The import takes a product-table lock, rejects any newly appeared normalized barcode, slug or source-claim collision, and never updates an existing product or colour.

## Supabase SQL Editor order

1. Confirm the dashboard project ref. Run [00-check-prerequisites.sql](00-check-prerequisites.sql) read-only. Record required objects and any genuinely absent ledger objects.
2. Before a separately approved schema or stock write, take a recoverable database backup and export Storage independently. Restore into an isolated project and verify historical references and balances.
3. If the preflight confirms a missing ledger object or movement reference column, review and run [01-add-missing-ledger.sql](01-add-missing-ledger.sql). If the contract is already present, skip it. Do not run baseline or shoe migrations for this batch.
4. Obtain explicit approval of the project and the exact payload fingerprint shown in [02-import-11-bags.sql](02-import-11-bags.sql). Only then replace the approval variable's NULL with that fingerprint and run the full file as one transaction. A matching committed replay leaves balances and receipt unchanged. The collision check is a write-time safeguard.
5. After commit, run [03-reconcile-11-bags.sql](03-reconcile-11-bags.sql) in a fresh session. This is the existing 90-post-import audit with the batch ID bound for SQL Editor. Expect 11 imported products, 54 units applied and zero mismatched variants. Record IMPORTED only after that receipt. On rollback, report the failure separately. For a committed correction, use a reviewed reconciliation and corrective stock movements that account for subsequent activity.

Disposable PostgreSQL verification passed with no shoe-size schema. It covered absent-ledger installation, rerun of ledger setup, rejection without approval, rollback on a normalized code collision, preservation of LB-532 and its historical references, the 11-product and 54-unit receipt, zero images, and replay after a one-unit decrease.
