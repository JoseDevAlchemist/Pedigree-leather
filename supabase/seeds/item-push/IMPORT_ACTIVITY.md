# Item push import activity

Workbook SHA-256: a299523b77936493abe5079d45a1687b6405ec75a4d0fcc3b0a832d54dc89aa5  
Review batch ID: cc7fea437268ed71bf06dbe81b4d4d0579bb4487a6f544f61f1f4491b09ced24  
Destination: unverified. Approved products: 0. Actual imports: 0.

## Activity

| Date | Phase | Status | Evidence |
| --- | --- | --- | --- |
| 2026-11-20 | Preparation | PREPARED | Read the item-push playbook and existing importer. Re-extracted the root workbook. Both previews matched the checked-in copies byte-for-byte. The workbook has 142 source rows and 768 recorded numeric units. |
| 2026-11-20 | Validation | TESTED | Nine Python tests and a disposable PostgreSQL suite passed. Synthetic checks covered commit receipts, zero and sized variants, rollback, source replay after sales, and a replay in a different batch. |
| 2026-11-20 | Approval | SKIPPED | No new project or batch was approved. All 142 source rows remain held in the execution preview. |
| 2026-11-20 | Execution | SKIPPED | No remote execution or real-stock reconciliation. There is no committed receipt for this batch. |

| 2026-11-20 | Preparation | PREPARED | Generated all eight numbered seeds, a shared SQL body, the workbook-bound manifest and the exception CSV. Five payloads represent 80 source-complete candidates and 671 units. The other three files are held-only. No project or batches were approved. |
| 2026-11-20 | Validation | TESTED | Three seed-specific tests passed. All eight generated files ran in a disposable PostgreSQL database using fixture approval and taxonomy. Refused approval left no writes. The fixture produced 80 unpublished products, 671 units and no images. Replay after a one-unit stock decrease stayed at 670 units with no duplicate products or audit claims. The fixture database was discarded. |

| 2026-11-20 | Destination verification | SKIPPED | The website and POS CLI links both point to scvscxbxfpjqbqkfkset (old production). The website has no local hosted app project ID and the POS app points to loopback. No new hosted project ID or verified read-only connection is available. No query was sent to either remote database. |
| 2026-11-20 | Final approval preparation | PREPARED | Saved the final approval manifest with all 80 prepared products and 671 units, bound to the five existing seed checksums. Verified those checksums, their embedded product payloads, source references, unique codes and slugs, and colour and size totals offline. The read-only target preflight SQL passed on empty disposable tables. The actual target validation remains pending. |

| 2026-11-20 | Existing project verification | SKIPPED | User selected scvscxbxfpjqbqkfkset and both CLI links match. DNS resolution was blocked and no verified read-only SQL configuration was available. No remote query, migration or import ran. |
| 2026-11-20 | First-batch review | PREPARED | Verified the workbook digest, five seed hashes, and all 12 products against CN rows 5–16. Saved the [80-record review](00-existing-project-review.json) and [first-batch backup and execution plan](FIRST-IMPORT-PLAN.md). All records remain REVIEW pending live matching. |

| 2026-11-20 | Bags receipt and shoe schema verification | SKIPPED | Target scvscxbxfpjqbqkfkset matches the saved links. DNS and a verified SQL connection remain unavailable. The committed ledger, bags reconciliation, deployed shoe schema and live code collisions are unverified. No remote query or write ran. |
| 2026-11-20 | Batch 04 approval preparation | PREPARED | Verified four unchanged seed payloads against the workbook, totalling 28 units. Created the [batch 04 approval and execution plan](04-SHOES-B-PLAN.md). Counts are 0 CREATE, 0 LINK, 4 REVIEW and 0 SKIP pending live checks and explicit approval. |

| 2026-11-20 | Batch 04 SQL validation | TESTED | Disposable PostgreSQL confirmed that missing bags receipts were never marked reconciled and the execution template refused unapproved input. Live target validation is still pending. |

| 2026-11-20 | Existing project, 11-bag plan | PREPARED | Used the supplied live match result. Excluded historical LB-532, leaving 11 create candidates and 54 units. Prepared [the minimal ledger and SQL Editor plan](02-existing-11-bags/README.md) for scvscxbxfpjqbqkfkset. No execution approval recorded. |
| 2026-11-20 | Existing project, 11-bag fixture | TESTED | Disposable PostgreSQL passed approval refusal, collision rollback, 11-product and 54-unit reconciliation, preservation of historical UUIDs, no seed images and replay after a stock change. No shoe schema was installed. No remote write ran. |
| 2026-11-21 | Production, 11-bag backup | TESTED | Restored both dumps from manual backup `20261121-134240` into network-isolated Supabase PostgreSQL 17.12 after applying the official Auth and Storage migrations. Checked restored foreign keys, including category parents, and verified catalogue, stock, orders, sales and payment counts. The approved import rehearsed successfully on the restore. |
| 2026-11-21 | Production, 11-bag execution | IMPORTED | Project `scvscxbxfpjqbqkfkset`. Batch `700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5`. Applied the three missing ledger tables. A separate read-only production session confirmed the committed receipt recorded at `2026-11-21T11:21:08.439641Z`, with 11 products, 11 source claims, 39 reconciled variant entries, 54 opening units and zero mismatches or skips. All 11 were unpublished drafts with zero image rows. Pre- and post-import fingerprints matched for existing products, including LB-532 and LB-2207, and historical stock, orders, sales and payments. |

| 2026-11-21 | Batch 02 production receipt | RECONCILED | Batch `700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5` still reconciled to 11 products, 39 colours, 54 opening units and zero receipt mismatches. Current colour stock also totalled 54. No Batch 02 inventory was changed. |
| 2026-11-21 | Remaining batches backup and schema | VERIFIED | Restored both dumps from private backup `20261121-150125-remaining-import` in isolated Supabase PostgreSQL and revalidated foreign keys. Rehearsed and applied canonical POS migration `20261118130000_pos_size_inventory.sql` plus the three existing import-writer functions. Pre- and post-migration production fingerprints matched across 20 relations. Existing products retained colour tracking, and the new size table was empty. |
| 2026-11-21 | Batch 04 isolated rehearsal | TESTED | Corrected the prior-receipt prerequisite to require the exact 11-bag receipt. The isolated import reconciled 4 products, 6 colours, 21 sizes and 28 units. An invalid approval was refused, and replay preserved a subsequent one-unit stock change. A sizing-system decision and exact production batch approval are pending. |
| 2026-11-21 | Batch 05 existing identity | HELD | Read-only matching confirmed LB-2207 already exists. Workbook row 92 records 24 units across six colours. Excluding it leaves 41 prepared create candidates and 327 workbook units for future approval. |

| 2026-11-21 | Shoe sizing decision | CONFIRMED | The store owner explicitly confirmed European (`EU`) sizing for all numbered shoe sizes in Batches 04, 03 and 08. The workbook’s original size labels and colour quantities are retained. |
| 2026-11-21 | Batch 04 production approval | PENDING | Bound the prepared EU plan to project `scvscxbxfpjqbqkfkset` and its live Shoes category. The payload contains 4 products, 6 colours, 21 sizes and 28 units. No barcode or slug collisions were found. The restored backup’s checksums matched. Candidate batch ID `3cb323adc97ab96fdd5d9989b4a9953a3f1e968193236c3ec9b0c7bacb0359db`. Exact approval SHA-256 `f1a55a2a93cb7b3a08d1986b490dd64bcd9976c8a5d91d3e0bed3c0a705a5f81`. |

| 2026-11-21 | Batch 04 EU production approval | APPROVED | The user explicitly approved 4 draft shoes, 6 colours, 21 EU size entries and 28 opening units on `scvscxbxfpjqbqkfkset` with approval SHA-256 `f1a55a2a93cb7b3a08d1986b490dd64bcd9976c8a5d91d3e0bed3c0a705a5f81`. The verified backup checksums matched immediately before execution. |
| 2026-11-21 | Batch 04 EU production execution | IMPORTED | Committed receipt `3cb323adc97ab96fdd5d9989b4a9953a3f1e968193236c3ec9b0c7bacb0359db`, recorded at `2026-11-21T12:19:06.653910Z`. The separate production reconciliation confirmed 4 draft shoes, 6 colours, 21 EU sizes, 6 source claims and 28 opening units. Every size label and quantity matched the approved plan. Size, colour, product and movement stock totals each reconciled to 28. Zero mismatches, skips or images. Historical fingerprints matched across 21 relations. Batch 03 received no writes. |

| 2026-11-21 | Batch 03 EU production preparation | TESTED | Verified Batch 04 production receipt `3cb323adc97ab96fdd5d9989b4a9953a3f1e968193236c3ec9b0c7bacb0359db` and the recovery backup checksums. Project `scvscxbxfpjqbqkfkset` had no Batch 03 code or slug collisions, prior source claims or committed receipt. A private production snapshot restored into isolated PostgreSQL allowed rehearsal against the real Batch 04 receipt. The exact payload produced 12 draft shoes, 15 colours, 47 EU sizes, 63 opening units, zero images and zero mismatches. The guard rejected an invalid approval and a wrong prior receipt. Existing records matched across 21 relations, and replay preserved a later stock decrease. |
| 2026-11-21 | Batch 03 EU exact approval | PENDING | Intended batch ID `3511fedb67f755b8cb20eb4ac8f99935c26126b1c888f6521ce715728dd2c694`. Approval SHA-256 `fdf2b6c6907cd5f3ad5d94daf222925650c7868b5ac866f43a62c8ef1d7bf9bd`. Guarded transaction file SHA-256 `58e9cc6521493393a46bd2092cdaeaeb629ed144a6c1e46f272c3615f1fc943b`. No production import ran. |

| 2026-11-21 | Batch 03 EU production approval | APPROVED | The user explicitly approved the bound Batch 03 payload on `scvscxbxfpjqbqkfkset` with SHA-256 `fdf2b6c6907cd5f3ad5d94daf222925650c7868b5ac866f43a62c8ef1d7bf9bd`. The backup and rehearsed transaction checksums matched before execution. |
| 2026-11-21 | Batch 03 EU production execution | IMPORTED | Committed receipt `3511fedb67f755b8cb20eb4ac8f99935c26126b1c888f6521ce715728dd2c694`, recorded at `2026-11-21T12:29:24.392889Z`. Separate production audit confirmed 12 unpublished drafts, 15 colours, 47 EU sizes, 15 source claims and 63 opening units. All size labels and quantities matched the approved payload. Size, colour, product and movement totals each reconciled to 63. Zero mismatches, skips or image rows. Existing records matched across all 21 checked relations. Batch 08 received no writes. |

| 2026-11-21 | Batch 08 EU production preparation | TESTED | Verified committed Batch 03 receipt `3511fedb67f755b8cb20eb4ac8f99935c26126b1c888f6521ce715728dd2c694`, recovery backup checksums, the canonical size table, writer and enabled stock triggers. Project `scvscxbxfpjqbqkfkset` had no Batch 08 barcode or slug collisions, source claims or committed receipt. The guarded rehearsal against an isolated production snapshot produced 10 draft shoes, 11 colours, 61 EU sizes, 170 opening units, zero images and zero mismatches. Invalid approval and a wrong prior receipt were rejected. Existing records matched across 21 relations, and replay preserved a later stock decrease. |
| 2026-11-21 | Batch 08 EU exact approval | PENDING | Intended batch ID `f1ea627631d1ed2cdaad0945fcb1625fe3d673132abaf2d0531d090dcc89f078`. Approval SHA-256 `19f4a8d2de2e5358515a95a0c812cc20251921c010cde057e62e9a9ba18230b2`. Guarded transaction file SHA-256 `f620ea9961338499883b43d5638521eefe5da4b942c93b7abadb02ea095ce85f`. No production import ran. |

| 2026-11-21 | Batch 08 EU production approval | APPROVED | The user explicitly approved the bound Batch 08 payload on `scvscxbxfpjqbqkfkset` with SHA-256 `19f4a8d2de2e5358515a95a0c812cc20251921c010cde057e62e9a9ba18230b2`. The backup and rehearsed transaction checksums matched before execution. |
| 2026-11-21 | Batch 08 EU production execution | IMPORTED | Committed receipt `f1ea627631d1ed2cdaad0945fcb1625fe3d673132abaf2d0531d090dcc89f078`, recorded at `2026-11-21T12:39:04.731655Z`. Production audit and independent live queries confirmed 10 unpublished drafts, 11 colours, 61 EU sizes, 11 source claims and 170 opening units. Every name, price, size label and quantity matched. Size, colour, product and movement totals each reconciled to 170. Zero mismatches, skips or images. Existing records matched across 21 relations. Batch 05 received no writes. |

| 2026-11-21 | Batch 05 production preparation | TESTED | Verified all four prior production receipts and source claims and matched the recoverable backup checksums. Excluded LB-2207 and all 24 of its workbook units. The remaining 41 products had no barcode, slug or source-row collisions and no prior receipt. The isolated rehearsal produced 41 drafts, 114 colours and 327 units with zero mismatches or image rows. Invalid approval and prior-receipt guards rejected the transaction. Existing records in 21 relations matched and replay preserved a later stock decrease. |
| 2026-11-21 | Batch 05 exact approval | PENDING | Project `scvscxbxfpjqbqkfkset`. Intended batch ID `6102a8a5020097237d22fe9917e3f5608a1f374b9e93ff927c884fddecdac784`. Approval SHA-256 `6b3ba76f73cae8329cb9f5459d0af154dbe9ee5a9be4b29de597a17a21104270`. Guarded SQL SHA-256 `c094ebc3374cf11f72454e12e8d65249c8f75eadb12587bf2f6a1209f20cd204`. No production import ran at preparation. |

| 2026-11-21 | Batch 05 production approval | APPROVED | The user approved 41 draft bags, 114 colours and 327 opening units on `scvscxbxfpjqbqkfkset` using exact SHA-256 `6b3ba76f73cae8329cb9f5459d0af154dbe9ee5a9be4b29de597a17a21104270`. Recovery backup and guarded SQL checksums matched. |
| 2026-11-21 | Batch 05 production execution | IMPORTED | Committed receipt `6102a8a5020097237d22fe9917e3f5608a1f374b9e93ff927c884fddecdac784`, recorded at `2026-11-21T12:54:55.175173Z`. Production receipt and independent live queries confirmed 41 unpublished draft bags, 114 colours and 327 opening units, with zero mismatches, duplicate codes, skips or image rows. Pre-existing records matched across 21 relations, including LB-2207 and LB-532. |
| 2026-11-21 | Final production workbook reconciliation | RECONCILED | The five receipts total 78 products, 185 colours, 129 EU sizes and 642 opening units. Read-only checks confirmed existing balances of 7 for LB-2207 and 0 for LB-532. [Final reconciliation and held rows](FINAL_WORKBOOK_RECONCILIATION.md). |

### Previous new-project proposal (superseded for this target)

1. Run [00-target-preflight.sql](00-target-preflight.sql) on the independently verified new project using a read-only session. Compare migration and schema findings against the POS and website prerequisites, and clear the candidate collision checks. Do not use the current CLI links.
2. Review [00-final-approval-manifest.json](00-final-approval-manifest.json). Proposed first batch is 02-cn-bags-a.sql with 12 products and 59 units. It is the smaller of the two batches that need no shoe sizing-system decision. Batch 04-cn-shoes-b.sql has four products and 28 units but requires that extra approval.
3. When separately authorized, run 02-cn-bags-a.sql using the existing [execution command](README.md#execution-after-approval). Run 90-post-import-audit.sql in a separate session after commit and confirm reconciliation before proceeding.
4. The remaining proposed order is 04-cn-shoes-b.sql, 03-cn-shoes-a.sql, 08-cn-broadway-shoes.sql, then 05-cn-bags-b.sql. Each needs separate approval. The three shoe files also need the confirmed size system. Reconcile each committed batch before running the next. Batches 01, 06 and 07 remain held-only.

[Source preview](../../../docs/catalogue-import/preview.json) · [Execution preview](../../../docs/catalogue-import/execution-preview.json) · [Offline event journal](import-events.jsonl)

## Status rules

| Status | Evidence required |
| --- | --- |
| PREPARED | The workbook digest, compiled plan and held rows have been saved. A prepared plan authorizes no writes. |
| TESTED | Record the test outcome and whether it came from disposable fixtures or approved staging. Fixture commits are not actual imports. |
| APPROVED | Obtain explicit approval of the new Supabase project ref and exact batch ID. Save the approval evidence and approver identity in the restricted change record. An event label is not authorization. |
| IMPORTED | In a separate session on the approved destination, read a committed receipt matching the batch and workbook. Reconcile all approved variant quantities and deltas before reporting the batch as imported. |
| SKIPPED | Record the reason, such as a held row, an unapproved batch or an identical source claim already applied. A batch replay preserves the original receipt. |
| FAILED | Record a confirmed rollback or rejected execution separately. Store only the error SQLSTATE and a sanitized summary if needed. A timeout or lost connection requires a read-only receipt check before declaring success or failure. |

## Execution and reconciliation

1. Compile the reviewed manifest with [the importer](../../../scripts/catalogue_bulk_import.py). Retain the immutable execution preview, candidate SQL, workbook hash and batch ID. The batch ID changes when the plan changes. Generating an artifact is an offline step.
2. Verify the target and review the [read-only schema audit](../../../docs/sql/catalogue-import-staging-audit.sql). Obtain approval for both the new project and batch before any remote write. The target must already have the reviewed [import SQL](../../../docs/sql/catalogue-excel-import.review.sql). Where an older importer already exists, review a forward migration for the audit tables and RPC. Earlier imports have no transactional variant receipt, so leave those historical snapshots unknown.
3. Execute the approved SQL transaction. The import RPC writes the batch, row claims, and variant audit together with inventory and stock movements. Audit records contain the source sheet and rows, code, product, colour and size UUIDs, action, quantities, outcome and timestamp. Source references are grouped so multiple workbook rows for one product never multiply stock.
4. After COMMIT, export a receipt using [90-post-import-audit.sql](90-post-import-audit.sql) in a new read-only session. Keep each reconciliation report with its batch and restricted approval record. It compares approved and committed balances and signed stock changes **at import time**. Later sales do not change the receipt. An explicit zero remains a valid audited balance. A skipped entry applies zero stock and carries no new committed balance.
5. Record phases in this file or append structured events with [item_push_activity.py](../../../scripts/item_push_activity.py). Keep attempt failures in the offline journal, outside the inventory transaction. Store credentials only in the approved connection configuration. Do not put connection strings, service-role keys, or raw database errors in the journal.

Example receipt export using a PostgreSQL connection already configured for the approved project:

~~~sh
psql -X -qAt -v ON_ERROR_STOP=1 -v batch_id="$BATCH_ID" \
  -f supabase/seeds/item-push/90-post-import-audit.sql > "$RECEIPT"
python scripts/item_push_activity.py "$PLAN" IMPORTED \
  --phase execution --project-ref "$VERIFIED_PROJECT_REF" --receipt "$RECEIPT"
~~~

After obtaining explicit approval, append an APPROVED event with --phase approval and the verified project ref. For a confirmed failure use the same plan with status FAILED and --phase execution and pass its SQLSTATE via --sqlstate. For a committed receipt containing only skips, record SKIPPED. Unconfirmed transport failures remain pending investigation in the activity notes.
