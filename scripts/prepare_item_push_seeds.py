"""Prepare eight item-push seed batches offline from the reviewed workbook layout."""

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re

from catalogue_import_preview import make_preview


SECTIONS = (
    ("01-vn-bags", "VN", 4, 39),
    ("02-cn-bags-a", "CN Working Sheet", 5, 16),
    ("03-cn-shoes-a", "CN Working Sheet", 19, 36),
    ("04-cn-shoes-b", "CN Working Sheet", 39, 56),
    ("05-cn-bags-b", "CN Working Sheet", 59, 101),
    ("06-cn-belt", "CN Working Sheet", 104, 104),
    ("07-cn-hua-cai-shoes", "CN Working Sheet", 107, 109),
    ("08-cn-broadway-shoes", "CN Working Sheet", 112, 122),
)
CATEGORY_SLUGS = {"bag": "bags", "shoe": "shoes", "belt": "belts"}
DESCRIPTION = "Description of this product will be added later"
NEUTRAL_SWATCH = "#808080"
PHOTO_ANGLES = ["front", "back", "side-left", "side-right", "top"]
ACCEPTED_NAME_FLAGS = {"missing_recorded_name", "recorded_name_is_code", "belt_discriminator_required"}


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def key_for(row):
    code = (row["pedigree_code"] or "").strip()
    return code.casefold() if code else f"source:{row['sheet']}:{row['row']}"


def source_record(preview, row):
    cells = preview["raw_sheets"][row["sheet"]]["cells"]
    addresses = {row["code_cell"], row["name_cell"], row["price_cell"], *row["review_cells"]}
    addresses.update(address for address in cells if re.search(r"\d+$", address)[0] == str(row["row"]))
    return {**row, "raw_cells": {address: cells.get(address) for address in sorted(addresses)}}


def slug_for(code):
    key = code.casefold()
    safe_code = re.sub(r"[^a-z0-9]+", "-", key).strip("-")[:52].rstrip("-")
    fingerprint = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"{safe_code or 'item'}-{fingerprint}"


def product_candidate(key, rows, name_counts):
    first = rows[0]
    category = first["category_candidate"]
    code = (first["pedigree_code"] or "").strip() or None
    names = {(row["recorded_name"] or "").strip() for row in rows}
    name = (first["recorded_name"] or "").strip() or "Not Named"
    issues = {issue for row in rows for issue in row["issues"]} - ACCEPTED_NAME_FLAGS
    if len(names) != 1:
        issues.add("multiple_recorded_names_for_code")
    if len(name) > 80 or (code and len(code) > 128):
        issues.add("catalogue_field_too_long")
    colours = {}
    for row in rows:
        for cell in row["inventory"]:
            label = (cell["colour"] or "").strip()
            if not label or cell["quantity"] is None:
                continue
            if len(label) > 40:
                issues.add("colour_label_too_long")
            if category == "shoe" and cell["size"] is None:
                continue
            colour = colours.setdefault(label, {"name": label, "hex": NEUTRAL_SWATCH, "quantity": 0, "sizes": []})
            colour["quantity"] += cell["quantity"]
            if category == "shoe":
                colour["sizes"].append({"label": cell["size"], "quantity": cell["quantity"]})
    if not colours:
        issues.add("no_importable_inventory")
    units = sum(row["numeric_units"] for row in rows)
    candidate = {
        "identity_key": key,
        "action": "create", "code": code, "name": name, "slug": slug_for(code) if code else None,
        "category": category, "category_id": None,
        "base_price": first["base_price_candidate"] if all(
            row["base_price_candidate"] == first["base_price_candidate"] for row in rows
        ) else None,
        "description": DESCRIPTION, "size_system": None, "colours": list(colours.values()),
        "allow_same_name": name == "Not Named" or name_counts[name.casefold()] > 1,
        "evidence": "Item-push workbook mapping; blank names and swatches use documented placeholders.",
        "source_rows": rows, "known_numeric_units": units if any(
            cell["quantity"] is not None for row in rows for cell in row["inventory"]
        ) else None,
        "review_issues": sorted(issues),
    }
    return candidate


def prepare_manifest(preview):
    by_key = defaultdict(list)
    for row in preview["records"]:
        by_key[key_for(row)].append(source_record(preview, row))
    name_counts = Counter(
        (rows[0]["recorded_name"] or "Not Named").strip().casefold() for rows in by_key.values()
    )
    buckets = defaultdict(dict)
    for key, rows in by_key.items():
        sections = {
            name for row in rows for name, sheet, first, last in SECTIONS
            if row["sheet"] == sheet and first <= row["row"] <= last
        }
        if len(sections) != 1:
            raise ValueError(f"Identity spans multiple item-push sections: {key}")
        candidate = product_candidate(key, rows, name_counts)
        buckets[sections.pop()][key] = candidate

    batches = []
    for name, sheet, first, last in SECTIONS:
        products = list(buckets[name].values())
        ready = [product for product in products if not product["review_issues"]]
        held = [product for product in products if product["review_issues"]]
        known = [product["known_numeric_units"] for product in products if product["known_numeric_units"] is not None]
        batch = {
            "file": name + ".sql", "sheet": sheet, "first_row": first, "last_row": last,
            "category": products[0]["category"],
            "counts": {
                "source_rows": sum(len(product["source_rows"]) for product in products),
                "distinct_coded_candidates": sum(product["code"] is not None for product in products),
                "uncoded_held_rows": sum(len(product["source_rows"]) for product in held if not product["code"]),
                "seed_products": len(ready), "seed_units": sum(product["known_numeric_units"] for product in ready),
                "held_coded_candidates": sum(product["code"] is not None for product in held),
                "known_numeric_units": sum(known) if known else None,
            },
            "ready_products": ready, "held_candidates": held,
        }
        batch["prepared_batch_id"] = hashlib.sha256(
            canonical_json({"workbook_sha256": preview["workbook_sha256"], **batch}).encode("utf-8")
        ).hexdigest()
        batches.append(batch)
    return {
        "workbook_sha256": preview["workbook_sha256"], "status": "PREPARED", "project_ref": None,
        "approved_batches": [],
        "photo_angles": PHOTO_ANGLES, "image_rows_to_create": 0,
        "display_placeholder": {"hex": NEUTRAL_SWATCH, "colour_hex_unverified": True},
        "batches": batches,
    }


def seed_sql(batch, workbook_hash):
    heading = (
        f"-- {batch['file']} | {batch['sheet']} rows {batch['first_row']}-{batch['last_row']}\n"
        f"-- Workbook SHA-256 {workbook_hash}\n"
        f"-- Prepared batch {batch['prepared_batch_id']}\n"
    )
    if not batch["ready_products"]:
        return heading + (
            "-- All candidates are held. See 00-manifest.json and 99-exceptions.csv.\n"
            "SELECT 'SKIPPED' AS outcome, 0 AS executable_products;\n"
        )
    # Review fields stay in the manifest. The RPC receives just its write contract
    # plus complete per-source-row provenance.
    products = [{k: v for k, v in product.items() if k not in {
        "identity_key", "known_numeric_units", "review_issues",
    }} for product in batch["ready_products"]]
    payload = canonical_json({
        "workbook_sha256": workbook_hash, "prepared_batch_id": batch["prepared_batch_id"],
        "category_slug": CATEGORY_SLUGS[batch["category"]], "products": products,
    })
    delimiter = "$item_push$"
    while delimiter in payload:
        delimiter = delimiter[:-1] + "_$"
    return heading + (
        "\\set ON_ERROR_STOP on\n"
        "BEGIN;\n"
        "SET LOCAL search_path = pg_catalog, public;\n"
        "CREATE TEMP TABLE item_push_input (payload jsonb) ON COMMIT DROP;\n"
        f"INSERT INTO pg_temp.item_push_input VALUES ({delimiter}{payload}{delimiter}::jsonb);\n"
        "SELECT set_config('item_push.approved_batch_id', :'approved_batch_id', true),\n"
        "       set_config('item_push.project_ref', :'verified_project_ref', true)"
        + (",\n       set_config('item_push.size_system', :'shoe_size_system', true)" if batch["category"] == "shoe" else "")
        + ";\n\\ir 00-apply-prepared-batch.sql\nCOMMIT;\n"
    )


def write_reports(manifest, directory):
    directory.mkdir(parents=True, exist_ok=True)
    for batch in manifest["batches"]:
        content = seed_sql(batch, manifest["workbook_sha256"])
        batch["sql_sha256"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
        (directory / batch["file"]).write_text(content, encoding="utf-8")
    shared_sql = directory / "00-apply-prepared-batch.sql"
    if shared_sql.is_file():
        manifest["shared_sql_sha256"] = hashlib.sha256(shared_sql.read_bytes()).hexdigest()
    (directory / "00-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (directory / "99-exceptions.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["batch", "identity", "code", "sheet", "row", "cell", "recorded_value", "issue", "next_action"])
        for batch in manifest["batches"]:
            for product in batch["held_candidates"]:
                for row in product["source_rows"]:
                    for issue in product["review_issues"]:
                        if issue not in row["issues"] and issue not in {"no_importable_inventory", "multiple_recorded_names_for_code"}:
                            continue
                        if issue == "invalid_quantity" or issue == "unmapped_cells":
                            addresses = row["review_cells"]
                        elif "price" in issue:
                            addresses = [row["price_cell"]]
                        elif "code" in issue or "identity" in issue:
                            addresses = [row["code_cell"]]
                        elif issue == "missing_colour":
                            addresses = [f"C{row['row']}"]
                        elif issue == "footwear_quantity_without_size":
                            addresses = [cell["cell"] for cell in row["inventory"]]
                        else:
                            addresses = [""]
                        for address in addresses:
                            cell = row["raw_cells"].get(address) or {}
                            writer.writerow([
                                batch["file"], product["identity_key"], product["code"], row["sheet"], row["row"],
                                address, cell.get("value"), issue, "Review source and approve a corrected manifest",
                            ])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    manifest = prepare_manifest(make_preview(args.workbook.read_bytes()))
    write_reports(manifest, args.directory)
    for batch in manifest["batches"]:
        print(batch["file"], json.dumps(batch["counts"]))


if __name__ == "__main__":
    main()
