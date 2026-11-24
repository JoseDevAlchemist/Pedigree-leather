# First import review for the existing project

**Approved verification destination: scvscxbxfpjqbqkfkset.** Both saved CLI links match. The website has no locally configured hosted endpoint and POS points to loopback. The sandbox could not resolve the approved hostname, and no secure SQL connection for that host was available. No remote SQL ran. Deployed compatibility and existing inventory remain unknown.

## First-batch review

The [existing-project review manifest](00-existing-project-review.json) contains all 80 prepared products. All remain REVIEW pending live identity, inventory and audit checks. The first 12 were checked against CN Working Sheet rows 5–16 and the existing seed payload. Eleven blank names use **Not Named** and the recorded **Hermes** name is preserved. All use **Description of this product will be added later**, a Bag root category, and the exact recorded code, KES price, colours and quantities. The seed contains no subcategory IDs or image writes. Colours can receive front, back, side-left, side-right and top photos later.

| Internal code | Action | Existing stock | Recorded starting stock |
| --- | --- | ---: | ---: |
| LB-532 | REVIEW | Unknown | 5 |
| LB-5569 | REVIEW | Unknown | 2 |
| LB-6867 | REVIEW | Unknown | 6 |
| LB-2419 | REVIEW | Unknown | 7 |
| LB-8931 | REVIEW | Unknown | 6 |
| LB-9343 | REVIEW | Unknown | 10 |
| LB-8710 | REVIEW | Unknown | 4 |
| LB-9283 | REVIEW | Unknown | 3 |
| LB-369 | REVIEW | Unknown | 4 |
| LB-6251 | REVIEW | Unknown | 6 |
| LB-9337 | REVIEW | Unknown | 1 |
| LB-28KL | REVIEW | Unknown | 5 |
| **Total** | **0 CREATE / 0 LINK / 12 REVIEW / 0 SKIP** | **Unknown** | **59 recorded. Insertion total unverified.** |

Prioritize LB-532 and LB-2207 when checking for earlier test records. No live conflicts have been confirmed or cleared. Normalize internal code whitespace and case for discovery and retain the workbook code in the plan. Similar names alone supply no identity. Use CREATE after ruling out existing product and audit claims. Use LINK only for an explicitly verified UUID and matching variants, price and stock, with existing historical UUIDs preserved. Use SKIP only when committed audit records match the product and source claim. Hold conflicting balances, prices and identities for REVIEW.

## Read-only checks and migration order

1. Establish a secure SQL session whose host and account identify the approved ref. Run [00-target-preflight.sql](00-target-preflight.sql) and the [read-only schema audit](../../../docs/sql/catalogue-import-staging-audit.sql). Compare actual columns, root categories, enabled triggers, RLS, grants, stock writer, website RPCs and import tables. Consult migration history alongside those checks.
2. Where its required relations exist, run [00-existing-project-match-readonly.sql](00-existing-project-match-readonly.sql). Review the 80 records, product and variant UUIDs, history counts and source claims. Check ledger claims even when a code has no product match. Review committed variant audit before assigning SKIP. Confirm the Bags root is active and top-level. The current seed is create-only, so an existing match requires a reviewed link plan or omission.
3. Order any confirmed migration gaps by dependency: shared catalogue and colour stock, POS product projection and movement audit, POS catalogue and size contract, website edit and checkout RPCs, cancellation RPC, import writer and audit. An older live object needs a forward migration. Apply only verified gaps after separate approval. Website 022 drops the product total and must not be replayed on the existing shared database. No missing object is confirmed today.

## Backup and execution gates

Before authorized changes, capture a recoverable database backup covering grants, migration ledger, catalogue, balances, sales, payments, returns and movements. Export Storage bytes and bucket configuration separately. Record the recovery point and rehearse restoration in an isolated database. Validate counts, constraints, balances and historical UUIDs. On failure, pause the affected writers, reconcile transactions after the backup and validate isolated recovery before any switch. Use a reviewed corrective movement for committed stock changes.

The [02-cn-bags-a.sql](02-cn-bags-a.sql) candidate uses a transaction and calls the idempotent import ledger. It requires an exact approved batch identifier. **The existing [shared SQL](00-apply-prepared-batch.sql) explicitly rejects the selected project under the previous new-project rule.** After live verification, prepare an existing-project execution artifact that allowlists the approved ref and binds the verified live action plan. The candidate and guard remain unchanged.

Execution order after the gates clear: verified backup → separately approved forward migrations if needed → repeat read-only matching → explicit approval of the final bound first batch → approved transaction → [90-post-import-audit.sql](90-post-import-audit.sql) in a fresh read-only session using the committed batch ID → reconcile inventory and record the result in [IMPORT_ACTIVITY.md](IMPORT_ACTIVITY.md). New products stay inactive and unpublished. There is no executable plan cleared for this target yet.
