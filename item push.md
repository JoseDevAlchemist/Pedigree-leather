# PEDIGREE LEATHER — EXCEL → SQL → SUPABASE ITEM PUSH

**Execution playbook for Codex | 20 November 2026 | Website-owned catalogue seeding**

> **Primary outcome:** Generate accurate, reviewable, idempotent SQL seed batches from `Pedigree Updated Stock Sheet Shared Copy.xlsx` (placed in the website project root), apply the approved seeds to the **explicitly verified NEW Supabase project**, and let the existing website and POS query those same records. **Do not build an Excel-upload UI.** No need to manually create ~100 products in admin. This document authorizes preparation, local verification and production-ready deliverables **without asking routine questions**; it does **not** authorize writing to any live project without an explicit destination approval.

## 0. Working locations and ownership

- Primary working directory: `~/Desktop/Projects/Pedigree-leather` (website). Expect Excel file `./Pedigree Updated Stock Sheet Shared Copy.xlsx`. Discover exact path by listing this directory; preserve the original workbook unchanged.
- Read-only shared contract repository: `~/Desktop/Projects/posversion2` (POS 2.0). The **canonical** sized-inventory migration is `supabase/migrations/20261118130000_pos_size_inventory.sql` in the POS repo. Verify its actual current contents; do not fabricate schema names or implement a second size table.
- Website currently has `docs/catalogue-import/preview.json`, `execution-preview.json`, `README.md`, `scripts/catalogue_import_preview.py`, `scripts/catalogue_bulk_import.py`, and review SQL under `docs/sql/` (depending on present worktree). Reuse, inspect and reconcile those assets. Current worktrees may have uncommitted changes; **preserve them**.
- Database tables from earlier integration: `products` (internal code generally `barcode`, not an assumed `product_code`), `categories`, `product_colors`, `product_images`, `product_color_sizes` for sized shoes, and their stock movements/import ledger. Confirm actual deployed/fresh-project schema through checked-in migration chain and read-only metadata before writing anything.
- Product entry and photos are managed **through website admin** after seeding. POS is a downstream consumer; no POS Excel importer, no separate inventory source.
- **Expected final deliverable:** `supabase/seeds/item-push/` with ordered SQL/data scripts, manifest, reconciliation CSV, acceptance report, rollback notes and dry-run commands. Name files clearly and execute them only when the intended destination is approved.

## 1. User's nonnegotiable business rules

1. Main category **only** `bag`, `shoe`, or `belt`; set corresponding active top-level `category_id` if present. **Never assign or guess a subcategory** such as laptop bag, pouch, handbag, sneakers or tote, even when words in names imply them. Do not classify by brand/style beyond the three main categories. If the category tree uses `bags`, `shoes`, `belts` as category slugs, map them to the actual existing rows while keeping agreed database legacy type compatible.
2. Use **exact source product name whenever supplied** (minor trim of surrounding whitespace is okay). If missing, use precisely `Not Named`. Do **not** invent a name from the SKU, brand, style, or appearance. Identical `Not Named` titles are allowed, but slugs must be unique and stable, e.g. `not-named-lb-532`.
3. For **every** product set the customer description to precisely: `Description of this product will be added later`. No generated marketing copy or materials/specification claims. If database/admin validation has a length requirement, adjust validation intentionally rather than silently changing the agreed placeholder.
4. Keep all product codes/barcodes as source data. On `CN` use column **D (Pedigree Code)** as the preferred internal SKU; column **C** means supplier/style code in bag sections but **colour** in shoe sections. In `VN`, column **C (Pedigree Code)** is the internal code. Do not put internal codes in anonymous website projections. Preserve spacing/case unless there is a documented normalization convention; use a separate normalized key for matching and flag collisions.
5. Exact quantities only. **Blank ≠ zero; numeric zero = zero**. Preserve zeros for zero-stock variants but do not invent rows for blank cells. Invalid text (`]` at CN row 26 size 41) must be flagged and excluded from stock, not coerced. Never assign stock `1` as a default.
6. **Shoes:** colour + precise size (39–46 where header supports it) + quantity. Only import a quantity when a valid size column is mapped by that section's size header. Colour-only shoe quantities (Hua Cai) remain unresolved for sized inventory; do not distribute across shoe sizes. Group colourway rows by a verified product identifier or unequivocal contiguous named family; do not guess grouping of un-coded variants.
7. **Bags and belts:** colour-level quantity where recorded. Some items (VN and belt row 104) have **unknown stock**. No fake stock. Whether zero-stock draft staging is technically permissible must be explicit in manifest as `unknown_not_imported`, not represented as verified physical count of zero. Prefer create product draft without stock transaction if target schema permits; otherwise hold the stock step while still preparing its product record.
8. Each **colour** can later have exactly five requested photographic positions: `front`, `back`, `side-left`, `side-right`, `top` (map “left side” and “right side” to existing angle enum). **No images are currently supplied.** Insert **no fake `product_images` records, fake URLs, colour swatches as files or imaginary five images**. Website’s current placeholders should render until images are uploaded, then retain product/colour UUIDs and inventory.
9. Newly imported items are **draft/unpublished** by default (`active=false`, `is_website_published=false`, `publish_to_pos=false` unless a verified schema requires a different controlled draft state). Website admin must be able to edit and publish later; confirm publication gates and existing POS visibility expectations. Never expose unreviewed draft records to public website.
10. **No auto-guessing missing prices**, not even a price of 8,000 for `PH 3459`. A missing, zero, conflicting or fractional selling price must be held for price approval. Price fields are KES and column header says **Selling Price Inc. VAT**; treat as final listed price, do not add VAT again. Preserve source numeric/formula result and flag any required rounding decision rather than silently round.
11. A seed must be **idempotent and sale-safe**. One product per approved identity key, stable product/colour/size UUIDs, import batch UUID/ledger, ON CONFLICT logic by verified unique key, and transactional write/rollback. Re-running a seed **must not reset stock after a sale**. Initial stock reconciliation needs approved stock cutoff and an applied-once ledger with optimistic/version checks; never use repeated absolute `UPDATE stock_quantity = ExcelValue` on live stock.
12. One new Supabase project for both apps. Never infer project identity from `.env` presence or use the old project reference `scvscxbxfpjqbqkfkset` as the destination. Print actual project URL/ref and stop before executing writes until user approves it. Do not disclose keys in logs. **No `supabase db reset` on a remote project.**

## 2. Workbook section mapping — interpret column meanings by row, not globally

Use the original workbook and verify cell values, formulas, cached results, hidden rows and merged cells. Preserve `source_sheet`, `source_row`, `source_column` for every mapped value. Do not infer a subtotal as an item.

| Batch | Sheet + inclusive source rows | Main category | Rule |
|---|---|---|---|
| `01-vn-bags` | `VN` rows **4–39** | `bag` | B product name, C Pedigree code, D VAT-inclusive price; **no stock or colour matrix**. Repeated PH codes and `... 2/3/4` names must be reviewed as possible colour/style entries; never manufacture variants. |
| `02-cn-bags-a` | `CN Working Sheet` rows **5–16** | `bag` | C supplier code, D internal Pedigree code, E:AR colours from **row 4**, AS stated total, AT price. Product name B may be empty → `Not Named`. |
| `03-cn-shoes-a` | `CN Working Sheet` rows **19–36** | `shoe` | **Row 18** defines size columns E=39,H=40,L=41,N=42,O=43,R=44,S=45,AS=46. B name (may be inherited on contiguous variant row), C **colour**, D internal code (may be inherited only with clear linked row), AT price. Do not treat row 4 colours here. |
| `04-cn-shoes-b` | `CN Working Sheet` rows **39–56** | `shoe` | **Row 38** repeats size mappings; names/colourways such as `ON Cloud Tilt`, `ON Cloud Surf X4`, `China Sport`. Some rows have no D SKU; don't invent one. Group only when justified and preserve unresolved identity flags. |
| `05-cn-bags-b` | `CN Working Sheet` rows **59–101** | `bag` | Row 4 colour headers E:AR, AS stated quantity, AT price. Codes in D. **Row 102 subtotal is not a product**. |
| `06-cn-belt` | `CN Working Sheet` **row 104** under `Lihua Belts` header row 103 | `belt` | Internal code `LSS-2125`, price 14,200, **quantity/colours not provided**. Name in row 104 is absent → `Not Named` unless user explicitly authorizes section heading as name (default: do NOT). No fabricated belt sizes. |
| `07-cn-hua-cai-shoes` | `CN Working Sheet` **rows 107–109**, header 106 | `shoe` | Name may be blank → `Not Named`; D codes `LB-A219`, `LB-A273`, `LB-A260` (do **not** recategorize as bags just because code starts `LB`). H=`Brown`, L=`Light Brown` with quantities 5+5 each. **Sizes are absent**: hold sized stock, don't pretend H/L are size columns. |
| `08-cn-broadway-shoes` | `CN Working Sheet` **rows 112–122**, header 111 | `shoe` | Size header E=39,H=40,L=41,N=42,O=43,R=44,S=45,AS=46; B code-like source name, C colour, D SKU. Row 117 `Coffee` is a colour continuation of row 116 `K599-6A` only if verified; preserve missing cells as inherited only under an explicit continuation rule. |

**Eight technically distinct batches** are safer than the earlier six because Hua Cai's missing sizes and belt's missing quantities must never be handled as normal bag inventory. You may expose a top-level six-section summary for readability, but keep these eight internal mappings separate. Skip blank/header rows 2,4,17,18,38,57,58,102,103,105,106,110,111,123 and any other section label/subtotal as applicable; **note that row 4 is a valid VN data row but a CN colour header**.

### CN bag colour header map (row 4; use exactly, verify any typo)

`E Black; F Black & Green; G Black & Brown; H White; I Milk White; J Off White; K Milkshake; L Khaki; M Light Khaki; N Caramel; O Burgundy; P Red; Q Anchor Red; R Blue; S Lake Blue; T Peacock Blue; U Linen Blue; V Green; W Oil Fruit Green; X Sage Green; Y Lake Green; Z Almond Green; AA Dark Green; AB Earthy Yellow; AC Coffee; AD Brown; AE Golden Brown; AF Chestnut Brown; AG Pottery Brown; AH Gray; AI Elephant Gray; AJ Light Gray; AK Gray Blue; AL Pink; AM Apricot; AN Taro Powder; AO Mayanlan; AP Biscuit; AQ Green Coffee; AR Purple.`

If the colour name is unfamiliar (`Mayanlan`, `Taro Powder`), preserve its **literal workbook name** rather than translating it. Do not invent physical colour HEX codes: only use a known verified mapping when available; otherwise nullable/default neutral display value with a recorded `colour_hex_unverified` flag and no misleading colour preview. Ensure colour names distinguish colourways accurately, e.g. `Black & Green` from `Black`.

### CN shoe size map (rows 18, 38, 111)

`E→39; H→40; L→41; N→42; O→43; R→44; S→45; AS→46`. Column **AS**, typically bag total, acts as **size 46 in shoe sections**! Never count it as a shoe subtotal. These sizes are header-defined; verify each section, do not rely on a universal column map. Some sections lack stock totals entirely: derive known shoe units by summing only valid size quantities. Keep unknown sizes unknown.

## 3. Known tricky real rows — regression examples

- `VN!4`: `Les Multi Pasport`, `PH 3459`, **missing price**. Never invent KES 8,000. No quantity or colours; product metadata may be drafted, price is blocked.
- `VN!5–6`: `PH 2102` appears twice with `Les Retro Bending Chains` and `Les Retro Bending Chains 2`. `VN!16–19` repeats `PH 2126` for four `Les Ruffle` names, row 19 **price 0** while others list 11,350. Do **not** arbitrarily overwrite the name or choose price; flag identity/price conflict. Other repeated VN codes exist; report all.
- `CN!5`: `LB-532`: Black 2, Khaki 1, Caramel 1, Almond Green 1 = **5 units** at **KES 12,850**; name `Not Named`, description placeholder, main category `bag`, no subcategory.
- `CN!92`: `LB-2207`: Black 4, Milk White 5, Caramel 4, Peacock Blue 4, Oil Fruit Green 4, Coffee 3 = **24 units** at **KES 7,100**. This is **one product** with six colour variants, not six product rows. Do not copy its old test product metadata blindly from prior Supabase.
- `CN!20–21`: `SS-G107`: `G107- Puma`, Black and Brown, each with different exact sizes/quantities. Preserve a stable SKU identity and per-colour size rows; do not overwrite Black with Brown.
- `CN!26`: `LSS-99051`: `High sole Comfort (1906)`, White, size 41 has invalid literal `]`; flag only that cell, preserve valid known other sizes. `CN!27` Black continuation; check and group safely.
- `CN!39–43`: `ON Cloud Tilt` has five colourways and missing D SKU. **Do not generate fake human-readable barcodes**. An internal deterministic import identity may track the row/family, but barcode remains null until approved; distinguish variants from distinct products carefully.
- `CN!77`: `LB-3301`: explicit total 0, no positive colours, price **19401.568627450983** (fractional KES). Hold price for approval; no pretend in-stock colour.
- `CN!104`: belt `LSS-2125` KES 14,200, **no verified stock**.
- `CN!107–109`: `LB-A219`, `LB-A273`, `LB-A260` are under **New Hua Cai Shoes** despite LB prefix. Each has Brown 5 and Light Brown 5 (30 units across rows), but no size breakdown. Do not seed those quantities into sellable shoe-size records; flag as physical colour-only stock pending sizes.
- `CN!116–117`: Broadway `K599-6A` Black and Coffee colourways; only row 116 provides B/D SKU. Apply continuation logic only with evidence, preserve size-specific quantities.
- `CN!102`: bag subtotal **351** (for its documented section), not an individual SKU. Cross-check line sums against subtotal and report any mismatch. Do not add subtotal again.

## 4. Parsing and reconciliation requirements

1. Read Excel with both **formula** and **cached numeric** value where needed; calculate correctly if cached value missing using a trusted Excel-compatible calculation path or flag unresolved. Never import formula source as a price string. Preserve original workbook SHA-256 as an immutable manifest input.
2. Write one structured intermediate record per **candidate product identity**, with nested colour variants and optional `sizes[]`, exact provenance, price, description placeholder, main category, category ID resolution state, source-code and source-name, and explicit `issues[]`.
3. Group explicit duplicated SKU rows carefully: preserve one SKU per eligible product; where repeated names/code represent variants, require consistent price and an unambiguous colour/source association. Flag genuine collisions. If row has no code, use a provisional **source-row-based import key for preview only**, not a public barcode.
4. Separate `source_rows`, `candidate_products`, `product_variants`, `size_balances`, `numeric_units`, `unresolved_units`, `draft_ready`, and `held_for_review`. The prior **142 rows / 768 numeric units / 110 coded candidates** are **baseline figures to independently recompute**, not a fixed expected product count. Previously 89 coded candidates needed source review, 12 uncoded shoe rows existed and 10 repeated codes were reported. If counts differ, explain why. No fake “approved” products: distinguish **technically importable draft metadata** vs **business-approved stock**.
5. For unpriced or malformed-price products, don't silently set 0 as an approved price. If schema requires non-null integer, hold the product until price approved, OR use a technically required 0 only in explicitly disabled/inactive staging draft with a clearly marked `price_unknown_placeholder` flag in manifest and no publication/checkout. Prefer holding rather than misrepresenting money.
6. Quantity handling: numeric 0 is recorded zero; blank is unknown/not recorded, invalid `]` is bad input. Cross-check bag row AS total against positive/zero-colour sum; report mismatch. Do not sum bag totals and per-colour cells together. In sized sections AS is size 46, not total.
7. Accurate slug construction: unique, stable across reimports and edits; use verified SKU or stable import identity. Names may repeat as `Not Named`. Barcode unique partial index must be respected. Never deduplicate only by display name.
8. Validate source data against target bounds, enum values, category FKs, price integer rules, colour stock, uniqueness, reserved/archived variants and all existing POS/website historical references. Prefer new empty destination with verified migrations; never transplant old test items into the fresh catalogue automatically.
9. On every uncertain row, create an **exception entry** with workbook cell address, exact original value, proposed category, reason, impact, and next action. Permit valid batches to proceed independent of held rows, but do not publish ambiguous products.

## 5. SQL seeding architecture and deployment guardrails

**First inspect actual migration schema; do not assume this file can prescribe executable SQL for unknown deployed objects.** Generate the SQL from the verified target contract. Preferred layout:

```
supabase/seeds/item-push/
  README.md
  00-manifest.json
  00-target-readonly-check.sql
  01-vn-bags.sql
  02-cn-bags-a.sql
  03-cn-shoes-a.sql
  04-cn-shoes-b.sql
  05-cn-bags-b.sql
  06-cn-belt.sql
  07-cn-hua-cai-shoes.sql
  08-cn-broadway-shoes.sql
  90-post-import-audit.sql
  99-exceptions.csv
  imported-products-preview.csv
```

- It is fine to generate SQL `INSERT` / `UPSERT` scripts plus an approved database RPC/import ledger instead of a website upload GUI. Do not require Python/Node to hold the service key if the SQL Editor (with verified project selector) can apply approved scripts safely.
- Use transaction-scoped batches. For metadata: match by stable approved internal code or approved UUID mapping, not display name. For colours/sizes: match using existing stable UUIDs/verified natural keys, preserve old IDs. Use project-local category IDs looked up by known top-level slugs (not hardcoded UUIDs from old Supabase).
- Stock: use the canonical `pos_change_variant_stock` (or current approved equivalent) and audit movement ledger as required. Inspect whether a dedicated import stock writer already exists and reuse it. Record a unique source workbook hash + batch + record ID with an applied-once claim. On replay, don't reapply starting inventory and don't overwrite balances changed by checkout/POS. Transaction must roll back all changes on partial failure.
- **No direct writes to `products.stock_quantity`**; existing triggers project colour totals. For sized shoes, use canonical size-to-colour-to-product projections without double counting. Ensure a zero-stock empty draft doesn't get fake sellable stock.
- Enforce proper role/authorization for admin writes; use site/server-side credentials if a script must run. Don't expose service role keys or log environment values. Public reads use explicit projection excluding `barcode`; publication enforced by app and future approved RLS.
- All import results should include deterministic source reference and new UUID mapping. Build a **read-only post-import audit** checking count by category, name placeholders, description placeholder exactness, no subcategories, stock sums, size detail, duplicate barcode, unpublished flags, no image rows, import ledger, and idempotency. Cross-compare aggregate source vs imported units **only for approved quantities**; don't count blocked cells as imported.
- A code push to GitHub is separate from SQL seeding. **Do not tell the user that pushing code uploads inventory.** Explicit step: (a) apply approved schema migrations to correct **new** project, (b) execute approved SQL seed batches, (c) point both apps at same project in deployment configuration, (d) verify catalogue reads; publish only after user review. For Vercel/Next caching, verify pages refresh after database changes.

## 6. Image contract — five photographs later, no fake rows now

- For **every colour variant** photo slots are: `front`, `back`, `side-left`, `side-right`, `top`. These are five possible angles in `product_images` keyed by (`color_id`, `angle`), **not five mandatory rows at seed time**. Existing schemas may support more angles; preserve extras and don't restrict the database to only five.
- Preserve real WebP upload support, direct Storage original URLs `/storage/v1/object/public/product-images/...` (Supabase Free plan). Avoid `/storage/v1/render/image/public/...` transformation requests. Add images later via website editor, stable product/colour UUID. Don't remove/recreate colour records to replace a photograph.
- Product cards must show an existing neutral/colour placeholder when image rows are absent. Do not make up actual HEX values or marketing copy; avoid publishing products with incomplete photos unless the user explicitly approves.

## 7. Work sequence — autonomous inside permitted boundary

**Phase A — inspect once.** From website root locate workbook; inspect `AGENTS.md` and relevant existing importer/schema files; read POS canonical migration and current `docs/catalogue-import/README.md`; list outstanding local changes. Don't repeat already verified broad investigations or edit payment integrations.

**Phase B — extract and normalize.** Implement / adapt a deterministic parser with eight section rules and per-cell provenance; generate a clean normalized preview, eight SQL batches and exception report. Use user-specified placeholders and no subcategories. Report counts per batch, names/colourways/sizes and known units.

**Phase C — local proof.** On disposable PostgreSQL fixtures only, test: `LB-532` 5 units and correct 4 colours; `LB-2207` 24 units and six colours; `SS-G107` separate Black/Brown size stock; invalid `CN!L26`; exact zero vs blank; Hua Cai no fictitious sizes; VN repeated codes/conflicting price; belt unknown stock; no images; all descriptions exact; `Not Named` for nameless items; no subcategories; no double stock; second seed run doesn't duplicate/restock; an intervening simulated sale survives replay. Use existing tests where possible; no 50-minute unfocused test loop.

**Phase D — verify destination read-only.** Show the user the proposed new Supabase project ref/URL, migration ledger, top-level category rows and stock writer availability. Flag if project points to known old ref `scvscxbxfpjqbqkfkset`. **Stop before any remote write unless user explicitly approves that project and import batches.** Do not misinterpret “do not ask permission while working” as permission for irreversible writes to an unconfirmed live service.

**Phase E — release instructions.** Provide exact commands/SQL Editor order including intended project identity and why; generate 90-post-import-audit.sql and dry-run report. Explain that later website admin edits/photos update records in Supabase; no further Git push needed for routine catalogue changes.

## Activity and audit trail

Maintain [IMPORT_ACTIVITY.md](supabase/seeds/item-push/IMPORT_ACTIVITY.md) through preparation, validation, approval and execution. Record PREPARED, TESTED, APPROVED, IMPORTED, SKIPPED or FAILED with evidence. Approve the exact batch and verified new project before remote writes. An import receipt must come from a separate read-only session after commit. Use [90-post-import-audit.sql](supabase/seeds/item-push/90-post-import-audit.sql) to reconcile the approved plan with the committed balances and movements. Record confirmed failed attempts separately using a sanitized error code.

## 8. Acceptance conditions and concise final report

- [ ] Source workbook found and SHA recorded; exact eight source sections parsed with correct contextual columns.
- [ ] Every named item uses its source name; nameless ones use **`Not Named`**; all descriptions exactly **`Description of this product will be added later`**.
- [ ] Category exclusively `bag` / `shoe` / `belt`, **no subcategories**.
- [ ] Bag colour quantities, shoe colour-size counts and all unknown/invalid values kept distinct and traceable.
- [ ] Stable code matching and safely handled duplicate/uncoded rows; no fake barcodes, names, prices, colours or stock.
- [ ] Five future image angles supported per colour; **zero invented image records**.
- [ ] Executable seed files / ledger + reconciliations prepared; safe against duplicate import or restock after a sale.
- [ ] Disposable fixture tests pass, showing named examples and counts. Unavailable runtime/deployed checks labelled blocked, not passed.
- [ ] Project ref verified and shown; **no remote writes without explicit destination approval**.

**Final response must be short and actionable:** (1) seed file paths, (2) batch-by-batch candidate/ready/held counts and known stock, (3) 5–10 most important workbook exceptions, (4) disposable test result, (5) exact NEW Supabase project ref or “unverified”, (6) exact next approval/seed step. Do not spend time reworking UI, payment gateways, fonts, unrelated POS features, or broad build checks that have already been blocked by the sandbox.

---

**Suggested Codex invocation:**

> Read `item push.md` completely and execute its permitted preparation phases A–C and E for the Excel workbook located in this website project root. Generate all eight SQL seed batches and the exception/preview manifest; use no invented data; preserve uncommitted changes. Perform the destination read-only check if possible but do not write to Supabase until the new project ref and batches are explicitly approved. Return only the concise completion report requested in section 8.
