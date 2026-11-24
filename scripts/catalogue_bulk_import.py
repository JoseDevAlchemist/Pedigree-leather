"""Compile a reviewed workbook manifest into an offline preview and optional SQL."""

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
from uuid import UUID

from catalogue_import_preview import make_preview


def required_text(value, field, limit):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f"Invalid {field}")
    return value.strip()


def integer(value, field, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"Invalid {field}")
    return value


def reviewed_product(entry, rows):
    action = entry.get("action")
    if action not in {"create", "link", "reconcile"}:
        raise ValueError("Action must be create, link or reconcile")
    product_id = str(UUID(entry["product_id"])) if action != "create" else None
    stock_cutoff = None
    if action == "reconcile":
        stock_cutoff = datetime.fromisoformat(required_text(entry.get("stock_cutoff"), "stock cutoff", 64))
        if stock_cutoff.utcoffset() is None:
            raise ValueError("Stock cutoff needs a timezone")
        stock_cutoff = stock_cutoff.isoformat()
    code = required_text(entry["code"], "code", 128)
    name = required_text(entry["name"], "name", 80)
    slug = required_text(entry["slug"], "slug", 80)
    if min(len(name), len(slug)) < 2 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError("Invalid slug")
    category = entry["category"]
    if category not in {"bag", "shoe", "belt"}:
        raise ValueError("Invalid category")
    category_id = str(UUID(entry["category_id"]))
    price = integer(entry["price_kes"], "price_kes", 1, 10_000_000)
    if entry.get("source_currency") != "KES":
        raise ValueError("Confirm the workbook price currency as KES")
    if not 1 <= len(entry["colours"]) <= 8:
        raise ValueError("Enter between one and eight reviewed colours")
    size_system = required_text(entry["size_system"], "size system", 32) if category == "shoe" else None

    colours = []
    observed = []
    for colour in entry["colours"]:
        label = required_text(colour["name"], "colour name", 40)
        hex_value = required_text(colour["hex"], "swatch hex", 7)
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", hex_value):
            raise ValueError("Invalid swatch hex")
        sizes = []
        if size_system:
            if not colour["sizes"]:
                raise ValueError("A shoe colour requires sized inventory")
            for size in colour["sizes"]:
                size_label = required_text(size["label"], "size label", 32)
                quantity = integer(size["quantity"], "size quantity", 0, 100_000)
                size_entry = {"label": size_label, "quantity": quantity}
                if action == "reconcile":
                    size_entry["expected_quantity"] = integer(
                        size.get("expected_quantity"), "expected size quantity", 0, 100_000
                    )
                sizes.append(size_entry)
                observed.append((label, size_label, quantity))
            if len({size["label"].lower() for size in sizes}) != len(sizes):
                raise ValueError("Duplicate size label")
            quantity = sum(size["quantity"] for size in sizes)
        else:
            if colour.get("sizes"):
                raise ValueError("Only footwear uses size-level stock")
            quantity = integer(colour["quantity"], "colour quantity", 0, 100_000)
            observed.append((label, None, quantity))
        colour_entry = {"name": label, "hex": hex_value, "quantity": quantity, "sizes": sizes}
        if action == "reconcile":
            colour_entry["expected_quantity"] = (
                sum(size["expected_quantity"] for size in sizes) if size_system else
                integer(colour.get("expected_quantity"), "expected colour quantity", 0, 100_000)
            )
        colours.append(colour_entry)
    if len({colour["name"].lower() for colour in colours}) != len(colours):
        raise ValueError("Duplicate colour")

    unchanged = (
        all(not row["issues"] for row in rows)
        and all((row["pedigree_code"] or "").strip() == code for row in rows)
        and all((row["recorded_name"] or "").strip() == name for row in rows)
        and all(row["category_candidate"] == category and row["base_price_candidate"] == price for row in rows)
        and Counter(observed) == Counter(
            ((cell["colour"] or "").strip(), cell["size"], cell["quantity"])
            for row in rows for cell in row["inventory"]
        )
    )
    evidence = entry.get("evidence")
    if not unchanged or action == "reconcile" or entry.get("allow_same_name"):
        evidence = required_text(evidence, "review evidence for source issues or changed values", 2000)
    description = entry.get("description", "")
    if not isinstance(description, str) or len(description) > 600:
        raise ValueError("Invalid customer description")
    return {
        "action": action, "product_id": product_id, "code": code, "name": name, "slug": slug,
        "category": category, "category_id": category_id, "base_price": price,
        "description": description, "size_system": size_system, "stock_cutoff": stock_cutoff,
        "colours": colours, "evidence": evidence, "allow_same_name": entry.get("allow_same_name") is True,
        "source_rows": rows,
    }


def compile_plan(preview, manifest):
    if manifest.get("workbook_sha256") != preview["workbook_sha256"]:
        raise ValueError("Manifest workbook digest does not match")
    rows = {}
    for row in preview["records"]:
        raw_cells = preview["raw_sheets"][row["sheet"]]["cells"]
        addresses = {row["name_cell"], row["code_cell"]}
        addresses.update(address for address in raw_cells if re.search(r"\d+$", address)[0] == str(row["row"]))
        rows[row["sheet"], row["row"]] = {
            **row, "raw_cells": {address: raw_cells[address] for address in sorted(addresses) if address in raw_cells},
        }
    products = []
    claimed = set()
    for entry in manifest.get("products", []):
        refs = sorted(tuple(ref) for ref in entry["rows"])
        if not refs or len(set(refs)) != len(refs) or claimed.intersection(refs):
            raise ValueError("Each selected source row must be assigned exactly once")
        if not set(refs).issubset(rows):
            raise ValueError("Manifest references an unknown source row")
        products.append(reviewed_product(entry, [rows[ref] for ref in refs]))
        claimed.update(refs)
    for field in ("code", "slug", "product_id"):
        values = [product[field].lower() for product in products if product[field] is not None]
        if len(values) != len(set(values)):
            raise ValueError(f"Duplicate planned {field}")

    # When any explicit duplicate is selected, the review must account for
    # every source row in the collision, including deliberately withheld rows.
    held = {}
    for entry in manifest.get("held_rows", []):
        ref = tuple(entry["row"])
        if ref not in rows or ref in claimed or ref in held:
            raise ValueError("Held rows must be unique and unassigned")
        held[ref] = required_text(entry["reason"], "hold reason", 2000)
    for group in preview["code_groups"]:
        refs = {tuple(ref) for ref in group["rows"]}
        if refs & claimed and not refs <= claimed | held.keys():
            raise ValueError(f"Account for every row sharing {group['normalized_code']}")

    return {
        "workbook_sha256": preview["workbook_sha256"],
        "totals": {
            "source_rows": len(rows), "planned_products": len(products),
            "planned_creates": sum(product["action"] == "create" for product in products),
            "planned_links": sum(product["action"] == "link" for product in products),
            "planned_stock_reconciliations": sum(product["action"] == "reconcile" for product in products),
            "claimed_rows": len(claimed), "blocked_rows": len(rows) - len(claimed),
            "numeric_units_in_planned_products": sum(
                colour["quantity"] for product in products for colour in product["colours"]
            ),
        },
        "products": products,
        "blocked_rows": [
            {"sheet": ref[0], "row": ref[1], "issues": row["issues"],
             "reason": held.get(ref, "review_manifest_required")}
            for ref, row in rows.items() if ref not in claimed
        ],
    }


def batch_id_for_plan(plan):
    """Bind the batch identifier to the exact reviewed products and holds."""
    content = json.dumps(plan, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def sql_for_plan(plan):
    if not plan["products"]:
        raise ValueError("No reviewed products to import")
    # Quote with a delimiter verified absent from the full JSON payload.
    batch_id = batch_id_for_plan(plan)
    payload = json.dumps({**plan, "batch_id": batch_id}, ensure_ascii=False, sort_keys=True)
    tag = "$catalogue$"
    while tag in payload:
        tag = tag[:-1] + "_$"
    return (
        f"-- Batch {batch_id}. Execute only after explicit batch and project approval.\n"
        "\\set ON_ERROR_STOP on\nBEGIN;\n"
        f"SELECT public.apply_excel_catalogue({tag}{payload}{tag}::jsonb);\nCOMMIT;\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("manifest", type=Path, help="review JSON tied to the workbook digest")
    parser.add_argument("preview", type=Path)
    parser.add_argument("--sql-out", type=Path, help="write a SQL artifact, without opening a database connection")
    args = parser.parse_args()
    preview = make_preview(args.workbook.read_bytes())
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    plan = compile_plan(preview, manifest)
    args.preview.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.sql_out:
        args.sql_out.write_text(sql_for_plan(plan), encoding="utf-8")
    print(json.dumps({"batch_id": batch_id_for_plan(plan), **plan["totals"]}, indent=2))


if __name__ == "__main__":
    main()
