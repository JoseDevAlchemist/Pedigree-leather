"""Read the reviewed Pedigree workbook layout and produce an offline preview."""

import argparse
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
import hashlib
from io import BytesIO
import json
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile


def read_workbook(payload):
    with ZipFile(BytesIO(payload)) as archive:
        def xml(path):
            return ET.fromstring(archive.read(path))

        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(node.text or "" for node in item.findall(".//{*}t"))
                for item in xml("xl/sharedStrings.xml")
            ]
        relationships = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in xml("xl/_rels/workbook.xml.rels")
        }
        sheets = {}
        for sheet in xml("xl/workbook.xml").findall(".//{*}sheet"):
            relation = next(value for key, value in sheet.attrib.items() if key.endswith("}id"))
            target = relationships[relation]
            path = target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target)
            root = xml(path)
            cells = {}
            for cell in root.findall(".//{*}c"):
                value = cell.findtext("{*}v")
                formula = cell.find("{*}f")
                kind = cell.get("t", "n")
                if kind == "s" and value is not None:
                    value = strings[int(value)]
                if kind == "inlineStr":
                    value = "".join(node.text or "" for node in cell.findall(".//{*}t"))
                if value is not None or formula is not None:
                    cells[cell.attrib["r"]] = {
                        "value": value,
                        "type": kind,
                        "style": cell.get("s"),
                        **({"formula": formula.text, "formula_attributes": formula.attrib}
                           if formula is not None else {}),
                    }
            sheets[sheet.attrib["name"]] = {
                "cells": cells,
                "merges": [node.attrib["ref"] for node in root.findall(".//{*}mergeCell")],
            }
        return sheets


def value(sheet, address):
    return sheet["cells"].get(address, {}).get("value")


def inherited(sheet, address):
    for merged in sheet["merges"]:
        match = re.fullmatch(r"([A-Z]+)([0-9]+):\1([0-9]+)", merged)
        if match:
            column, start, end = match.groups()
            if address.startswith(column) and address[len(column):].isdigit():
                if int(start) <= int(address[len(column):]) <= int(end):
                    address = column + start
                    break
    return value(sheet, address), address


def whole_number(sheet, address, minimum, maximum):
    cell = sheet["cells"].get(address)
    if not cell or cell["value"] is None or cell["type"] != "n":
        return None
    try:
        number = Decimal(cell["value"])
        if number.is_finite() and minimum <= number <= maximum and number == number.to_integral_value():
            return int(number)
    except InvalidOperation:
        pass
    return None


def make_preview(payload):
    sheets = read_workbook(payload)
    vn, cn = (sheets[name] for name in ("VN", "CN Working Sheet"))
    # Layout version 1. Any additional populated row needs explicit classification.
    sections = [
        ("VN", range(4, 40), "bag", None),
        ("CN Working Sheet", range(5, 17), "bag", 4),
        ("CN Working Sheet", range(19, 37), "shoe", 18),
        ("CN Working Sheet", range(39, 57), "shoe", 38),
        ("CN Working Sheet", range(59, 102), "bag", 4),
        ("CN Working Sheet", range(104, 105), "belt", None),
        ("CN Working Sheet", range(107, 110), "shoe", 106),
        ("CN Working Sheet", range(112, 123), "shoe", 111),
    ]
    structural = {
        "VN": {2},
        "CN Working Sheet": {2, 4, 17, 18, 38, 57, 58, 102, 103, 105, 106, 110, 111, 123},
    }
    expected = [(vn, "B2", "Product Name"), (vn, "C2", "Pedigree Code"),
                (vn, "D2", "Selling Price Inc. VAT"), (cn, "B2", "Product Name"),
                (cn, "C2", "Code"), (cn, "D2", "Pedigree Code"),
                (cn, "AT2", "Selling Price Inc. VAT"), (cn, "AS4", "Total Quantity"),
                (cn, "B103", "Lihua Belts"), (cn, "B106", "New Hua Cai Shoes")]
    if set(sheets) != set(structural) or any(value(s, a) != v for s, a, v in expected):
        raise ValueError("Workbook headers differ from layout version 1")
    for name in sheets:
        known = structural[name] | {row for s, rows, _, _ in sections if s == name for row in rows}
        if any(int(re.search(r"\d+$", cell)[0]) not in known for cell in sheets[name]["cells"]):
            raise ValueError(f"Unclassified populated row in {name}")

    colors = [chr(i) for i in range(ord("E"), ord("Z") + 1)] + [
        "A" + chr(i) for i in range(ord("A"), ord("R") + 1)
    ]
    sizes = dict(zip(("E", "H", "L", "N", "O", "R", "S", "AS"), map(str, range(39, 47))))
    for header in (18, 38, 111):
        if any(value(cn, col + str(header)) != size for col, size in sizes.items()):
            raise ValueError(f"Unexpected size headers on row {header}")
    if any(not value(cn, col + "4") for col in colors):
        raise ValueError("Incomplete colour matrix headers")
    if [value(cn, col + "106") for col in ("H", "L")] != ["Brown", "Light Brown"]:
        raise ValueError("Unexpected Hua Cai colour headers")

    records = []
    for name, rows, category, header in sections:
        sheet = sheets[name]
        addresses_by_row = defaultdict(list)
        for address in sheet["cells"]:
            addresses_by_row[int(re.search(r"\d+$", address)[0])].append(address)
        for row in rows:
            if not addresses_by_row[row]:
                continue
            suffix = str(row)
            pedigree_column, price_column = ("C", "D") if name == "VN" else ("D", "AT")
            recorded_name, name_cell = inherited(sheet, "B" + suffix)
            code, code_cell = inherited(sheet, pedigree_column + suffix)
            price_cell = price_column + suffix
            price = whole_number(sheet, price_cell, 1, 10_000_000)
            issues = []
            if not (recorded_name or "").strip():
                issues.append("missing_recorded_name")
            if not (code or "").strip():
                issues.append("missing_pedigree_code")
            if price is None:
                raw_price = value(sheet, price_cell)
                issues.append("missing_price" if raw_price is None else
                              "zero_price" if raw_price == "0" else "invalid_catalogue_price")
            if recorded_name and code and recorded_name.strip().casefold() == code.strip().casefold():
                issues.append("recorded_name_is_code")

            footwear_sizes = header in (18, 38, 111)
            color = value(sheet, "C" + suffix) if footwear_sizes else None
            columns = sizes if footwear_sizes else colors if header == 4 else {"H", "L"} if header == 106 else ()
            inventory = []
            review_cells = []
            recognized = {"B", pedigree_column, price_column}
            if name != "VN":
                recognized.add("C")
            if header == 4:
                recognized.add("AS")
            for col in sorted(columns, key=lambda col: (len(col), col)):
                recognized.add(col)
                cell = col + suffix
                if cell not in sheet["cells"]:
                    continue
                qty = whole_number(sheet, cell, 0, 100_000)
                inventory.append({
                    "cell": cell, "quantity": qty,
                    "colour": color if footwear_sizes else value(sheet, col + str(header)),
                    "size": sizes[col] if footwear_sizes else None,
                })
                if qty is None:
                    review_cells.append(cell)
            if review_cells:
                issues.append("invalid_quantity")
            if footwear_sizes and not (color or "").strip():
                issues.append("missing_colour")
            if header == 106:
                issues.append("footwear_quantity_without_size")
            if not inventory:
                issues.append("no_quantity_cells")
            if category == "belt":
                issues.append("belt_discriminator_required")
            unexpected = sorted(
                address for address in addresses_by_row[row]
                if re.match(r"[A-Z]+", address)[0] not in recognized
            )
            if unexpected:
                issues.append("unmapped_cells")
            units = sum(item["quantity"] for item in inventory if item["quantity"] is not None)
            total_cell = "AS" + suffix
            workbook_total = whole_number(sheet, total_cell, 0, 2_147_483_647) if header == 4 else None
            if header == 4 and (workbook_total is None or workbook_total != units):
                issues.append("row_total_mismatch_or_missing")
            records.append({
                "sheet": name, "row": row, "category_candidate": category,
                "recorded_name": recorded_name, "name_cell": name_cell,
                "source_code": value(sheet, "C" + suffix) if header in (4, 106) or category == "belt" else None,
                "pedigree_code": code, "code_cell": code_cell,
                "price_cell": price_cell, "source_price": value(sheet, price_cell), "base_price_candidate": price,
                "colour": color, "inventory": inventory, "numeric_units": units,
                "workbook_row_total": workbook_total, "review_cells": review_cells + unexpected,
                "customer_description": None, "issues": issues,
                "candidate_flags_for_new_products": {
                    "active": False, "is_website_published": False, "publish_to_pos": False,
                },
            })

    codes, uncoded_names = defaultdict(list), defaultdict(list)
    for record in records:
        key = (record["pedigree_code"] or "").strip().casefold()
        if key:
            codes[key].append(record)
        elif record["recorded_name"]:
            uncoded_names[record["recorded_name"].strip().casefold()].append(record)

    groups = []
    for key, items in codes.items():
        origins = {(item["sheet"], item["code_cell"]) for item in items}
        if len(items) == 1:
            continue
        merged = len(origins) == 1
        if not merged:
            for item in items:
                item["issues"].append("duplicate_code_requires_resolution")
        groups.append({
            "normalized_code": key,
            "kind": "merged_workbook_colour_rows" if merged else "duplicate_explicit_code",
            "rows": [[item["sheet"], item["row"]] for item in items],
            "recorded_names": [item["recorded_name"] for item in items],
            "prices": [item["source_price"] for item in items],
        })
    for items in uncoded_names.values():
        if len(items) > 1:
            for item in items:
                item["issues"].append("same_name_uncoded_variant_requires_resolution")

    candidates = []
    for key, items in codes.items():
        entries = [entry for item in items for entry in item["inventory"]]
        labels = {
            ((entry["colour"] or "").strip().casefold(), entry["size"]) for entry in entries
        }
        prices = {item["base_price_candidate"] for item in items}
        for item in items:
            if len(labels) != len(entries):
                item["issues"].append("repeated_colour_size_key")
            if len(prices) > 1:
                item["issues"].append("conflicting_price_for_code")
            if len({colour for colour, _ in labels}) > 8:
                item["issues"].append("exceeds_website_colour_limit")
        issues = sorted({issue for item in items for issue in item["issues"]})
        candidates.append({
            "identity_key": key,
            "source_rows": [[item["sheet"], item["row"]] for item in items],
            "review_issues": issues,
            "disposition": "source_review_required" if issues else "staging_match_required",
            "candidate_new_product": None if issues else {
                "name": items[0]["recorded_name"].strip(),
                "category": items[0]["category_candidate"],
                "barcode": items[0]["pedigree_code"].strip(),
                "base_price": items[0]["base_price_candidate"],
                "description": "",
                **items[0]["candidate_flags_for_new_products"],
            },
        })

    summary = {}
    for name, rows, category, header in sections:
        selected = [item for item in records if item["sheet"] == name and item["row"] in rows]
        numeric = sum(item["numeric_units"] for item in selected)
        cached = value(cn, "AS102") if rows.start == 59 else None
        summary[f"{name} {rows.start}-{rows.stop - 1}"] = {
            "category_candidate": category, "source_rows": len(selected), "numeric_units": numeric,
            "row_total_sum": sum(item["workbook_row_total"] or 0 for item in selected) if header == 4 else None,
            "cached_section_subtotal": cached,
            "subtotal_difference": numeric - int(cached) if cached is not None else None,
        }

    return {
        "workbook_sha256": hashlib.sha256(payload).hexdigest(),
        "layout_version": 1,
        "mode": "offline_preview",
        "totals": {
            "source_rows": len(records), "candidate_coded_identities": len(codes),
            "uncoded_source_rows": sum(not item["pedigree_code"] for item in records),
            "duplicate_explicit_codes": sum(group["kind"] == "duplicate_explicit_code" for group in groups),
            "merged_colour_groups": sum(group["kind"] == "merged_workbook_colour_rows" for group in groups),
            "rows_missing_customer_description": len(records),
            "numeric_units": sum(item["numeric_units"] for item in records),
            "inventory_cells": sum(len(item["inventory"]) for item in records),
            "explicit_zero_quantities": sum(entry["quantity"] == 0 for item in records for entry in item["inventory"]),
            "issues_by_source_row": dict(sorted(Counter(issue for item in records for issue in item["issues"]).items())),
            "coded_identities_requiring_source_review": sum(
                item["disposition"] == "source_review_required" for item in candidates
            ),
            "coded_identities_requiring_staging_match": sum(
                item["disposition"] == "staging_match_required" for item in candidates
            ),
            "catalogue_create_update": None,
            "database_writes": 0,
        },
        "section_reconciliation": summary,
        "code_groups": groups,
        "coded_candidates": candidates,
        "records": records,
        "raw_sheets": sheets,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    preview = make_preview(args.workbook.read_bytes())
    args.output.write_text(json.dumps(preview, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(preview["totals"], indent=2))


if __name__ == "__main__":
    main()
