# Prepared item-push seeds

The [manifest](00-manifest.json) covers 142 source rows, 110 distinct coded candidates and 768 recorded units. Five files contain 80 source-complete product candidates and 671 units. Thirty coded candidates and 12 uncoded rows are held in the manifest and [exception report](99-exceptions.csv). The remaining 97 recorded units belong to held records. Unknown quantities remain unknown.

| Seed file | Coded candidates | Products in seed | Recorded units | Units in seed |
| --- | ---: | ---: | ---: | ---: |
| [01-vn-bags.sql](01-vn-bags.sql) | 23 | 0 | Unknown | 0 |
| [02-cn-bags-a.sql](02-cn-bags-a.sql) | 12 | 12 | 59 | 59 |
| [03-cn-shoes-a.sql](03-cn-shoes-a.sql) | 14 | 12 | 70 | 63 |
| [04-cn-shoes-b.sql](04-cn-shoes-b.sql) | 4 | 4 | 88 | 28 |
| [05-cn-bags-b.sql](05-cn-bags-b.sql) | 43 | 42 | 351 | 351 |
| [06-cn-belt.sql](06-cn-belt.sql) | 1 | 0 | Unknown | 0 |
| [07-cn-hua-cai-shoes.sql](07-cn-hua-cai-shoes.sql) | 3 | 0 | 30 | 0 |
| [08-cn-broadway-shoes.sql](08-cn-broadway-shoes.sql) | 10 | 10 | 170 | 170 |
| **Total** | **110** | **80** | **768 known** | **671** |

The twelve uncoded rows in batch 04 are separate unresolved source rows. No product identities were assigned to them. The three held-only files return SKIPPED and contain no writes. The manifest retains raw cells, price values and issue lists for every held candidate. Review corrections separately from this generated snapshot.

Products with blank source names use **Not Named**. All seed descriptions are **Description of this product will be added later**. The seeds resolve active top-level Bags, Shoes and Belts by slug in the destination, and fail if the corresponding category is missing. All inserted products are inactive and unpublished. The neutral #808080 swatch fills a required database column and is flagged as unverified. It does not describe the item's physical colour. The seeds insert no image records. Website admin can later add front, back, side-left, side-right and top photos to each saved colour.

## Offline regeneration and fixture test

Run from the website repo root. The fixture test creates and removes its own PostgreSQL data directory.

~~~sh
PYTHONDONTWRITEBYTECODE=1 python scripts/prepare_item_push_seeds.py \
  'Pedigree Updated Stock Sheet Shared Copy.xlsx' supabase/seeds/item-push
PYTHONDONTWRITEBYTECODE=1 python tests/item-push-seeds.test.py
PYTHONDONTWRITEBYTECODE=1 python tests/item-push-seeds.test.py --single-backend
~~~

## Execution after approval

The checked-in manifest has **no approved batches** and the project ref is unverified. Source-complete means the recorded product, price and variant quantities are unambiguous. Approval still requires the verified new project, each exact batch and the chosen shoe sizing system. The workbook records size numbers but does not specify their system. Check both the file SHA-256 and the shared SQL SHA-256 against the manifest. Verify the connection's actual project independently. The supplied project ref is recorded in the bound plan and cannot attest to the connection.

Once authorized, use psql with the reviewed Supabase schema and the existing transactional import RPC. Configure the connection separately so credentials stay out of the command and logs. Pass the approved batch's prepared ID from the manifest. For shoes, also pass the explicitly approved sizing system. The files use a relative psql include to run the [shared batch SQL](00-apply-prepared-batch.sql).

~~~sh
psql -X -v ON_ERROR_STOP=1 \
  -v approved_batch_id="$APPROVED_PREPARED_BATCH_ID" \
  -v verified_project_ref="$VERIFIED_PROJECT_REF" \
  -v shoe_size_system="$APPROVED_SHOE_SIZE_SYSTEM" \
  -f "supabase/seeds/item-push/$APPROVED_SEED_FILE"
~~~

The bound plan derives a database batch ID after resolving category UUIDs and the approved sizing system. Capture that ID and run the existing [read-only audit](90-post-import-audit.sql) in a separate session after COMMIT. Record the prepared ID, bound database batch ID and matching committed receipt in [IMPORT_ACTIVITY.md](IMPORT_ACTIVITY.md). The optional JSONL helper is for plans compiled directly by the Python importer, which uses a different batch ID serialization. An exact rerun leaves original claims and inventory intact, including stock changed by later sales. If a seed aborts, its transaction rolls back. A committed batch needs an explicitly reviewed inventory reconciliation before any reversal, especially if sales have since occurred.
