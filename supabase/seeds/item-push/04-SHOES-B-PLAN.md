# Batch 04 approval preparation

Target project ref is **scvscxbxfpjqbqkfkset**. No batch execution is approved.

| Code | Product | Price (KES) | Workbook units | Proposed action |
| --- | --- | ---: | ---: | --- |
| SS-6008 | China Sport | 11,700 | 10 | REVIEW |
| SS- SC | Stark Comfort | 11,700 | 6 | REVIEW |
| SS-DC | Dream Comfort | 11,700 | 6 | REVIEW |
| LSS- 6H061 | New York Tide Boots | 11,700 | 6 | REVIEW |

The [approval review](04-shoes-b-approval-review.json) preserves each colour and numbered size, exact quantities including zero, the original internal code, and the description placeholder. Blank names would use **Not Named**. The original [seed](04-cn-shoes-b.sql) stays unchanged. New products stay inactive and unpublished. No image rows or uploads are part of the transaction. Front, back, side-left, side-right and top photos can be added later.

## Review and execution order

1. Use a verified read-only connection to run [04-shoes-b-approval-readonly.sql](04-shoes-b-approval-readonly.sql). Confirm the 11 approved bag rows (6–16) match the committed Batch 02 receipt and the approved balances total 54. Row 5, LB-532, was excluded. Compare committed receipt balances rather than current stock. Resolve missing or inconsistent evidence before proceeding.
2. Verify the live size table, size tracking mode, projection triggers, canonical writer and active top-level Shoes category. Check all four codes and slugs against live products, along with import claims from the [existing-project matching query](00-existing-project-match-readonly.sql). Compare actual variants and stock for any proposed LINK. Hold ambiguous or conflicting matches. Use SKIP for matching committed claims.
3. Confirm the shoe sizing system explicitly. The workbook provides numeric size labels but no sizing-system name. Review the secure database backup and rehearsal from the [first-import plan](FIRST-IMPORT-PLAN.md). Create the exact bound plan from the checked-in seed payload and reviewed decisions, with the verified category UUID, sizing system, existing UUIDs for links, target project ref, prepared batch ID and unique database batch ID. Compare all four variant payloads with the original seed before approving the plan.
4. Record explicit approval for the verified project, exact bound JSON, and its SHA-256 calculated against the PostgreSQL JSONB text representation. The [execution template](04-shoes-b-execution-template.sql) requires that JSON, its approved hash, verified project ref and the independently reconciled bags batch ID. It accepts reviewed CREATE and LINK decisions only, rejects normalized code and slug collisions inside the transaction, and uses the existing import writer. If any record is REVIEW or SKIP, prepare a separately approved subset. The original generic helper retains its old target guard.
5. After separately authorized execution **and** confirmed commit, run [90-post-import-audit.sql](90-post-import-audit.sql) with the actual database batch ID. Reconcile the committed result before recording IMPORTED in [IMPORT_ACTIVITY.md](IMPORT_ACTIVITY.md).

Current result: **0 CREATE / 0 LINK / 4 REVIEW / 0 SKIP**. Bags receipt, deployed size support and live matching are unverified. The batch is not safe to execute.
