"""Run pure importer tests and optional disposable PostgreSQL integration."""

import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from catalogue_bulk_import import batch_id_for_plan, compile_plan, sql_for_plan
from item_push_activity import activity_event
from catalogue_import_preview import make_preview

FIXTURE = runpy.run_path(str(ROOT / "tests/catalogue-import-preview.test.py"))["fixture"]
CATEGORY = "10000000-0000-4000-8000-000000000001"
REQUEST = "10000000-0000-4000-8000-000000000002"
POS_ROOT = Path(os.environ.get("PEDIGREE_POS_ROOT", ROOT.parent / "posversion2"))


def source_and_manifest():
    preview = make_preview(FIXTURE({
        "B104": "Belt", "D104": "BELT-1", "AT104": 14200,
    }))
    common = {"action": "create", "category_id": CATEGORY, "source_currency": "KES"}
    shoe = {
        **common, "rows": [["CN Working Sheet", 19], ["CN Working Sheet", 20]],
        "name": "Shoe", "code": "000123", "slug": "sized-shoe", "category": "shoe",
        "size_system": "EU", "price_kes": 100,
        "colours": [
            {"name": "Blue", "hex": "#0000ff", "sizes": [
                {"label": "40", "quantity": 1}, {"label": "41", "quantity": 0}, {"label": "46", "quantity": 2},
            ]},
            {"name": "Red", "hex": "#ff0000", "sizes": [{"label": "40", "quantity": 3}]},
        ],
    }
    belt = {
        **common, "rows": [["CN Working Sheet", 104]], "name": "Belt",
        "code": "BELT-1", "slug": "fixture-belt", "category": "belt", "price_kes": 14200,
        "evidence": "Fixture count approved by supervisor",
        "colours": [{"name": "Black", "hex": "#000000", "quantity": 5}],
    }
    bag = {
        **common, "rows": [["CN Working Sheet", 59]], "name": "Bag name",
        "code": "Bag code", "slug": "fixture-bag", "category": "bag", "price_kes": 33,
        "evidence": "Fixture colour counts verified",
        "colours": [{"name": "Colour H", "hex": "#ffffff", "quantity": 4}],
    }
    return preview, {"workbook_sha256": preview["workbook_sha256"], "products": [shoe, belt, bag]}


class ImporterTest(unittest.TestCase):
    def test_blank_review_holds_every_row(self):
        preview, manifest = source_and_manifest()
        plan = compile_plan(preview, {**manifest, "products": []})
        self.assertEqual(plan["totals"]["blocked_rows"], len(preview["records"]))
        with self.assertRaisesRegex(ValueError, "No reviewed products"):
            sql_for_plan(plan)

    def test_preserves_grouped_sized_stock_and_explicit_zero(self):
        preview, manifest = source_and_manifest()
        plan = compile_plan(preview, manifest)
        self.assertEqual(plan, compile_plan(preview, manifest))
        self.assertEqual(plan["totals"]["planned_creates"], 3)
        self.assertEqual(plan["totals"]["numeric_units_in_planned_products"], 15)
        self.assertEqual(plan["products"][0]["colours"][0]["sizes"][1]["quantity"], 0)
        self.assertEqual(plan["products"][0]["source_rows"][1]["code_cell"], "D19")

    def test_requires_evidence_and_matching_digest(self):
        preview, manifest = source_and_manifest()
        with self.assertRaisesRegex(ValueError, "workbook digest"):
            compile_plan(preview, {**manifest, "workbook_sha256": "bad"})
        manifest["products"][0]["price_kes"] = 42
        with self.assertRaisesRegex(ValueError, "review evidence"):
            compile_plan(preview, manifest)

    def test_requires_whole_duplicate_group(self):
        preview, manifest = source_and_manifest()
        manifest["products"][0]["rows"].pop()
        manifest["products"][0]["evidence"] = "Fixture workaround"
        with self.assertRaisesRegex(ValueError, "Account for every row"):
            compile_plan(preview, manifest)

    def test_activity_requires_committed_receipt(self):
        preview, manifest = source_and_manifest()
        plan = compile_plan(preview, manifest)
        project = "abcdefghijklmnopqrst"
        receipt = {
            "confirmation": "COMMITTED", "batch_id": batch_id_for_plan(plan),
            "workbook_sha256": plan["workbook_sha256"], "mismatched_variants": 0,
            "imported_products": 3, "skipped_products": 0,
        }
        with self.assertRaisesRegex(ValueError, "matching"):
            activity_event(plan, "IMPORTED", project, {**receipt, "confirmation": "NO_COMMITTED_BATCH"})
        self.assertEqual(activity_event(plan, "IMPORTED", project, receipt)["imported_products"], 3)
        self.assertEqual(activity_event(plan, "FAILED", project, sqlstate="23514")["error_sqlstate"], "23514")
        with self.assertRaises(ValueError):
            activity_event(plan, "FAILED", project, sqlstate="08006")


def integration(single_backend=False):
    preview, manifest = source_and_manifest()
    plan = compile_plan(preview, manifest)
    with tempfile.TemporaryDirectory(prefix="catalogue-stock-pg-") as work:
        data = Path(work) / "data"
        subprocess.run(["initdb", "-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"], check=True)
        if not single_backend:
            subprocess.run(["pg_ctl", "-D", data, "-l", Path(work) / "postgres.log", "-o",
                            f"-k {work} -c listen_addresses=''", "-w", "start"], check=True)
        try:
            command = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", work, "-d", "postgres"]

            def sql(statement, error=None):
                if single_backend:
                    text = "\n".join(line for line in statement.splitlines() if line.strip() and not line.startswith(r"\set"))
                    role = re.match(r"^(set role [a-z_]+;)\s+", text, flags=re.I)
                    if role:
                        text = role[1] + "\n\n" + text[role.end():]
                    result = subprocess.run(["postgres", "--single", "-j", "-D", data, "postgres"],
                                            input=text + "\n\n", text=True, capture_output=True, timeout=12)
                    errors = [line for line in result.stderr.splitlines() if "ERROR:" in line or "FATAL:" in line]
                    if error:
                        assert any(error in line for line in errors), result
                    else:
                        assert not errors and not result.returncode, result
                    rows = []
                    for position, value in re.findall(r'^\t (\d+): .+? = "(.*)"\t', result.stdout, flags=re.M):
                        if position == "1":
                            rows.append([])
                        rows[-1].append(value)
                    return "\n".join("|".join(row) for row in rows)
                result = subprocess.run(command, input=statement, text=True, capture_output=True, timeout=12)
                if error:
                    assert result.returncode and error in result.stderr, result
                else:
                    assert not result.returncode, result.stderr
                return result.stdout.strip()

            def quoted(value):
                return "$fixture$" + json.dumps(value) + "$fixture$::jsonb"

            fixture = (ROOT / "tests/catalogue-stock.fixture.sql").read_text()
            bootstrap, website = fixture.split("-- Website-specific fixture", 1)
            sql(bootstrap)
            migrations = POS_ROOT / "supabase/migrations"
            canonical = migrations / "20261118130000_pos_size_inventory.sql"
            for migration in sorted(migrations.glob("*.sql")):
                if migration.name > canonical.name:
                    continue
                sql(migration.read_text())
            if not canonical.exists():
                raise FileNotFoundError(canonical)
            sql("-- Website-specific fixture" + website)
            for filename in ("website-edit-product.review.sql", "catalogue-sized-stock.review.sql",
                             "website-cancel-order.review.sql", "catalogue-excel-import.review.sql"):
                sql((ROOT / "docs/sql" / filename).read_text())
            rejected = json.loads(json.dumps(plan))
            rejected["products"][-1]["category_id"] = REQUEST
            sql("set role service_role;\n" + sql_for_plan(rejected), "catalogue_category_unavailable")
            assert sql("select count(*) from products;") == "0"
            assert sql("select count(*) from excel_catalogue_imports;") == "0"
            assert sql("select count(*) from stock_movements;") == "0"
            def reconciliation(batch_plan):
                audit_sql = (ROOT / "supabase/seeds/item-push/90-post-import-audit.sql").read_text()
                statement = audit_sql.replace(":'batch_id'", "'" + batch_id_for_plan(batch_plan) + "'")
                return json.loads(sql("set role service_role; " + statement))

            assert reconciliation(rejected)["confirmation"] == "NO_COMMITTED_BATCH"
            assert sql("select count(*) from excel_catalogue_batch_audit;") == "0"
            assert json.loads(sql("set role service_role;\n" + sql_for_plan(plan)))["created"] == 3
            original_receipt = reconciliation(plan)
            assert original_receipt["confirmation"] == "COMMITTED"
            assert original_receipt["imported_products"] == 3
            assert original_receipt["approved_variant_units"] == original_receipt["committed_variant_units"] == 15
            assert original_receipt["approved_stock_delta"] == original_receipt["committed_stock_delta"] == 15
            assert original_receipt["mismatched_variants"] == 0
            zero = next(row for row in original_receipt["records"] if row["variant"]["size_label"] == "41")
            assert zero["variant"]["size_id"] and zero["variant"]["stock_quantity_applied"] == 0
            assert len(zero["source_rows"]) == 2
            assert sql("select count(*) from products where stock_tracking_mode='size' and publish_to_pos;") == "0"
            if not single_backend:
                assert sql("set role anon; select count(id) from products;") == "0"
                assert sql("set role anon; select count(*) from product_color_sizes;") == "0"
            else:
                assert sql("select count(*) from pg_policies where policyname='Read published sizes';") == "1"
            assert sql("select sum(stock_quantity) from products where slug in ('sized-shoe','fixture-belt','fixture-bag');") == "15"
            assert sql("select count(*) from product_images;") == "0"
            sql("set role anon; select barcode from public.products;", "permission denied")
            product, color, size40, size46 = sql("""
                select p.id, c.id, s.id, sl.id from products p join product_colors c on c.product_id=p.id
                join product_color_sizes s on s.color_id=c.id and s.size_label='40'
                join product_color_sizes sl on sl.color_id=c.id and sl.size_label='46'
                where p.slug='sized-shoe'
            """).split("|")
            sql(f"update products set active=true,is_website_published=true where id='{product}';")
            if not single_backend:
                assert sql("set role anon; select count(id) from products; select count(*) from product_color_sizes;") == "1\n4"
            sql(f"update products set publish_to_pos=true where id='{product}';")
            sql(f"update product_colors set stock_quantity=stock_quantity-1 where id='{color}';", "size_stock_requires_size_id")
            order = {"order_number": "PED-2026-0001", "subtotal": 200, "delivery_fee": 0,
                     "customer_name": "Fixture", "customer_phone": "000", "delivery_method": "pickup"}
            first = {"product_id": product, "color_id": color, "size_id": size40, "quantity": 1, "unit_price": 100}
            second = {**first, "size_id": size46}

            def checkout(items, request=REQUEST, details=order):
                return f"select * from public.website_create_order('{request}', {quoted(details)}, {quoted(items)});"

            sql(f"update product_color_sizes set archived=true where id='{size40}';")
            sql(checkout([first, second]), "website_variant_unavailable")
            sql(f"update product_color_sizes set archived=false where id='{size40}';")
            sql("set role service_role; update product_color_sizes set stock_quantity=0;", "permission denied")
            sql(checkout([{**first, "size_id": None}, second]), "website_variant_unavailable")
            sql(checkout([first, {**second, "unit_price": 50}]), "website_price_changed")
            assert sql("select count(*) from orders;") == "0"
            assert sql(f"select stock_quantity from products where id='{product}';") == "6"
            first_result = sql("set role service_role; " + checkout([first, second]))
            duplicate = sql("set role service_role; " + checkout([first, second]))
            assert first_result.endswith("|t") and duplicate == first_result[:-1] + "f"
            assert sql("select size_system, size_label from order_items order by size_label;") == "EU|40\nEU|46"
            assert sql(f"select stock_quantity from products where id='{product}';") == "4"
            assert sql(f"select count(*) from stock_movements where reference_uuid='{REQUEST}';") == "2"
            sql(f"delete from product_color_sizes where id='{size40}';", "violates foreign key constraint")

            actor = REQUEST[:-1] + "5"
            auth_user = REQUEST[:-1] + "6"
            sql(f"insert into auth.users(id) values ('{auth_user}');"
                f"insert into pos_users(id,auth_user_id,name,pin_hash,role) values "
                f"('{actor}','{auth_user}','Isolated cashier','fixture','cashier');")
            pos_request = REQUEST[:-1] + "7"
            cash_cart = [{**second, "price_at_sale": 100}]
            pos_sale = (f"set role authenticated; select set_config('request.jwt.claim.sub','{auth_user}',false); "
                        f"select public.pos_record_sale('{pos_request}','{actor}',100,'cash',100,{quoted(cash_cart)});")
            web_sale = ("set role service_role; "
                        + checkout([second], REQUEST[:-1] + "3", {**order, "subtotal": 100, "order_number": "PED-2026-0003"}))
            if single_backend:
                sql(pos_sale)
                sql(web_sale, "website_variant_unavailable")
            else:
                # Both requests pass the last unit through the same locked writer.
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=2) as race:
                    results = list(race.map(lambda q: subprocess.run(command, input=q, text=True, capture_output=True, timeout=12),
                                            [pos_sale, web_sale]))
                assert sorted(result.returncode for result in results) == [0, 3]
                assert any(marker in next(result.stderr for result in results if result.returncode)
                           for marker in ("website_variant_unavailable", "insufficient_stock"))
            assert sql(f"select count(*) from stock_movements where size_id='{size46}' and delta=-1;") == "2"
            assert json.loads(sql("set role service_role;\n" + sql_for_plan(plan))) == {"created": 0, "linked": 0, "reconciled": 0, "replayed": 3}
            assert reconciliation(plan) == original_receipt
            skip_plan = {**plan, "products": plan["products"][:1]}
            assert json.loads(sql(sql_for_plan(skip_plan)))["replayed"] == 1
            skipped = reconciliation(skip_plan)
            assert skipped["imported_products"] == 0 and skipped["skipped_products"] == 1
            assert skipped["committed_stock_delta"] == 0
            assert all(row["variant"]["color_id"] and row["variant"]["size_id"] for row in skipped["records"])
            assert sql(f"select stock_quantity from products where id='{product}';") == "3"
            assert sql(f"select count(*) from stock_movements where product_id='{product}' and reason='excel_catalogue_import';") == "3"

            sized_reconcile = json.loads(json.dumps(plan))
            sized_reconcile["workbook_sha256"] = "d" * 64
            sized_reconcile["products"] = sized_reconcile["products"][:1]
            shoe = sized_reconcile["products"][0]
            shoe.update(action="reconcile", product_id=product,
                        stock_cutoff="2026-11-20T09:00:00+03:00", evidence="Fixture cutoff")
            for colour in shoe["colours"]:
                for size in colour["sizes"]:
                    size["expected_quantity"] = size["quantity"] if colour["name"] == "Red" else 0
                    size["quantity"] = size["expected_quantity"] + (2 if size["label"] == "46" else 0)
                colour["expected_quantity"] = sum(size["expected_quantity"] for size in colour["sizes"])
                colour["quantity"] = sum(size["quantity"] for size in colour["sizes"])
            sql(f"update product_color_sizes set archived=true where id='{size40}';")
            sql(sql_for_plan(sized_reconcile), "catalogue_existing_stock_mismatch")
            sql(f"update product_color_sizes set archived=false where id='{size40}';")
            assert json.loads(sql(sql_for_plan(sized_reconcile)))["reconciled"] == 1
            revised = reconciliation(sized_reconcile)
            assert revised["approved_stock_delta"] == revised["committed_stock_delta"] == 2
            assert revised["mismatched_variants"] == 0
            assert sql(f"select stock_quantity from product_color_sizes where id='{size46}';") == "2"
            assert sql(f"select stock_quantity from product_colors where id='{color}';") == "2"
            assert sql(f"select stock_quantity from products where id='{product}';") == "5"
            assert json.loads(sql(sql_for_plan(sized_reconcile)))["replayed"] == 1
            assert sql(f"select count(*) from stock_movements where size_id='{size46}' and delta=2;") == "2"

            saved_colours = json.loads(sql(f"""
                select jsonb_agg(jsonb_build_object('id', id, 'name', color_name,
                  'hex', color_hex, 'order', sort_order, 'images', '[]'::jsonb) order by id)
                from product_colors where product_id='{product}'
            """))
            edit = {
                "expected": {
                    "product": ["Shoe", "sized-shoe", "", "shoe", CATEGORY, 100, None, "000123",
                                True, 0, False, True, True, "size"],
                    "colors": saved_colours,
                },
                "name": "Edited shoe", "slug": "sized-shoe", "description": "Fixture shoe",
                "category": "shoe", "categoryId": CATEGORY, "basePrice": 100, "barcode": "000123",
                "publishToPos": True, "discountPercent": 0, "featured": False, "active": True,
                "colors": saved_colours,
            }

            def website_edit(draft):
                return f"set role service_role; select public.website_edit_product('{product}', {quoted(draft)});"

            stale = json.loads(json.dumps(edit))
            stale["expected"]["product"][-1] = "color"
            sql(website_edit(stale), "website_edit_stale")
            sql(website_edit({**edit, "category": "bag"}), "website_sized_product_requires_shoe_category")
            assert sql(website_edit(edit)) == product
            assert sql(f"select name, stock_tracking_mode, stock_quantity from products where id='{product}';") == "Edited shoe|size|5"
            assert sql(f"select color_id, stock_quantity from product_color_sizes where id='{size46}';") == f"{color}|2"
            assert sql(f"select count(*) from order_items where size_id='{size46}';") in {"1", "2"}

            changed = json.loads(json.dumps(plan))
            changed["products"][0]["base_price"] += 1
            sql(sql_for_plan(changed), "catalogue_source_rows_already_claimed")
            conflicting = json.loads(json.dumps(plan))
            conflicting["workbook_sha256"] = "a" * 64
            sql(sql_for_plan(conflicting), "catalogue_possible_existing_product")
            link = json.loads(json.dumps(plan))
            link["workbook_sha256"] = "b" * 64
            link["products"] = [link["products"][1]]
            link["products"][0]["action"] = "link"
            link["products"][0]["product_id"] = sql("select id from products where slug='fixture-belt';")
            belt_id = link["products"][0]["product_id"]
            sql(f"update products set barcode=null where id='{belt_id}';")
            assert json.loads(sql(sql_for_plan(link)))["linked"] == 1
            linked = reconciliation(link)
            assert linked["approved_variant_units"] == linked["committed_variant_units"] == 5
            assert linked["committed_stock_delta"] == 0
            assert sql(f"select barcode, stock_quantity from products where id='{belt_id}';") == "BELT-1|5"
            reconcile = json.loads(json.dumps(link))
            reconcile["workbook_sha256"] = "c" * 64
            entry = reconcile["products"][0]
            entry.update(action="reconcile", stock_cutoff="2026-11-20T09:00:00+03:00", evidence="Fixture cutoff")
            entry["colours"][0].update(expected_quantity=4, quantity=7)
            sql(sql_for_plan(reconcile), "catalogue_existing_stock_mismatch")
            entry["colours"][0]["expected_quantity"] = 5
            assert json.loads(sql(sql_for_plan(reconcile)))["reconciled"] == 1
            assert sql(f"select stock_quantity from products where id='{belt_id}';") == "7"
            sql(f"update product_colors set stock_quantity=6 where product_id='{belt_id}';")
            assert json.loads(sql(sql_for_plan(reconcile)))["replayed"] == 1
            assert sql(f"select stock_quantity from products where id='{belt_id}';") == "6"
            sql(f"update products set base_price=101, discount_percent=10, active=true, is_website_published=true where id='{belt_id}';")
            belt_colour = sql(f"select id from product_colors where product_id='{belt_id}';")
            belt_line = {"product_id": belt_id, "color_id": belt_colour, "quantity": 1, "unit_price": 91}
            sql(checkout([belt_line], REQUEST[:-1] + "9", {**order, "subtotal": 91, "order_number": "PED-2026-0009"}))
            assert sql("select subtotal, discount_total, total from orders where order_number='PED-2026-0009';") == "101|10|91"
            # The committed reservation is the source of cancellation quantities.
            cancel_id = first_result.split("|")[0]
            cancel_sql = (
                f"set role service_role; select public.website_cancel_order('{cancel_id}',"
                "'fixture@example.test','worker','Synthetic cancellation');"
            )
            sql(f"set role service_role; update orders set status='cancelled' where id='{cancel_id}';",
                "website_use_cancel_order")
            sql(f"update product_color_sizes set archived=true where id='{size40}';")
            if single_backend:
                assert sql(cancel_sql) == "t"
                assert sql(cancel_sql) == "f"
            else:
                from concurrent.futures import ThreadPoolExecutor
                from threading import Barrier

                start = Barrier(2)

                def concurrent_cancel():
                    start.wait(timeout=5)
                    return sql(cancel_sql)

                with ThreadPoolExecutor(max_workers=2) as race:
                    attempts = [race.submit(concurrent_cancel) for _ in range(2)]
                    assert sorted(attempt.result() for attempt in attempts) == ["f", "t"]
            assert sql(f"select stock_quantity from product_color_sizes where id='{size40}';") == "1"
            assert sql(f"select stock_quantity from product_color_sizes where id='{size46}';") == "3"
            assert sql(f"select count(*) from order_status_history where order_id='{cancel_id}' and to_status='cancelled';") == "1"
            assert sql(f"select sum(delta) from stock_movements where reference_uuid='{REQUEST}' and reason='website_order_cancelled';") == "2"
            sql(f"update orders set status='paid',payment_status='paid',payment_reference='FIXTURE' where id='{cancel_id}';")
            assert sql(f"select status,payment_status,payment_reference from orders where id='{cancel_id}';") == "cancelled|paid|FIXTURE"
            assert sql(cancel_sql) == "f"
            no_reservation = sql("""
                insert into orders(order_number,customer_name,customer_phone,delivery_method,delivery_fee,subtotal,
                   discount_total,total,status,payment_status,payment_reference)
                values ('PED-LEGACY','Legacy','000','pickup',0,100,0,100,'paid','paid','LEGACY')
                returning id;
            """)
            assert sql(f"select public.website_cancel_order('{no_reservation}','fixture@example.test','owner','Legacy');") == "t"
            assert sql(f"select count(*) from stock_movements where reason='website_order_cancelled';") == "2"
            assert sql(f"select payment_status,payment_reference from orders where id='{no_reservation}';") == "paid|LEGACY"

            legacy_product = "10000000-0000-4000-8000-000000000014"
            legacy_colour = "10000000-0000-4000-8000-000000000015"
            legacy_request = "10000000-0000-4000-8000-000000000016"
            sql(f"""
                insert into products(id,name,slug,category,base_price,active,is_website_published)
                values ('{legacy_product}','Unconverted shoe','unconverted-shoe','shoe',100,true,true);
                insert into product_colors(id,product_id,color_name,color_hex,stock_quantity)
                values ('{legacy_colour}','{legacy_product}','Black','#000000',1);
            """)
            legacy_line = {"product_id": legacy_product, "color_id": legacy_colour, "quantity": 1, "unit_price": 100}
            sql(checkout([legacy_line], legacy_request, {**order, "subtotal": 100, "order_number": "PED-LEGACY-SHOE"}))
            sql(f"update products set stock_tracking_mode='size' where id='{legacy_product}';",
                "website_open_colour_reservation")

            legacy_order = sql(f"select id from orders where website_request_id='{legacy_request}';")
            cancel_legacy = f"select public.website_cancel_order('{legacy_order}','fixture@example.test','owner','Legacy');"
            sql(f"update orders set status='out_for_delivery' where id='{legacy_order}';")
            sql(cancel_legacy, "website_cancel_ineligible")
            sql(f"update orders set status='pending_payment' where id='{legacy_order}';")
            sql(f"""
                select public.pos_change_variant_stock('{legacy_product}','{legacy_colour}',null,1,false);
                insert into stock_movements(product_id,color_id,delta,quantity_after,reason,reference_uuid)
                values ('{legacy_product}','{legacy_colour}',1,1,'website_order_cancelled','{legacy_request}');
            """)
            assert sql(cancel_legacy) == "t"
            assert sql(f"select stock_quantity from product_colors where id='{legacy_colour}';") == "1"
            assert sql(f"select count(*) from stock_movements where reference_uuid='{legacy_request}' and delta>0;") == "1"

            # Exercise the sibling POS catalogue against an active dynamic belt branch.
            manager_id = "10000000-0000-4000-8000-000000000010"
            manager_auth = "10000000-0000-4000-8000-000000000011"
            pos_belt = "10000000-0000-4000-8000-000000000012"
            belt_child = "10000000-0000-4000-8000-000000000013"
            sql(f"""
                insert into auth.users(id) values ('{manager_auth}');
                insert into pos_users(id,auth_user_id,name,pin_hash,role)
                  values ('{manager_id}','{manager_auth}','Fixture manager','fixture','manager');
                insert into categories(id,is_active,slug,name,parent_id) values
                  ('{pos_belt}',true,'belts','Belts',null),
                  ('{belt_child}',true,'dress-belts','Dress belts','{pos_belt}');
            """)

            def as_staff(uid, statement):
                return f"set role authenticated; select set_config('request.jwt.claim.sub','{uid}',false); {statement}"

            belt_payload = {
                "name": "POS Belt fixture", "category": "belt", "categoryId": belt_child, "description": "Fixture belt",
                "barcode": "BELT-POS", "basePrice": 100, "discountPercent": 0, "isWebsitePublished": True,
                "colors": [{"name": "Black", "hex": "#000000", "stockQuantity": 3, "images": []}],
            }
            sql(as_staff(manager_auth, f"select public.pos_manager_save_catalogue_product('{pos_belt}',{quoted(belt_payload)});"))
            assert sql(f"set role service_role; select category,stock_tracking_mode,category_id from products where barcode='BELT-POS';") == f"belt|color|{belt_child}"
            pos_belt_colour = sql(f"select id from product_colors where product_id='{pos_belt}';")
            belt_payload.update(productId=pos_belt, name="Edited POS Belt")
            belt_payload["colors"][0]["id"] = pos_belt_colour
            sql(as_staff(manager_auth, f"select public.pos_manager_save_catalogue_product(gen_random_uuid(),{quoted(belt_payload)});"))
            assert sql(f"select name,stock_quantity from products where id='{pos_belt}';") == "Edited POS Belt|3"
            pos_belt_cart = [{"product_id": pos_belt, "color_id": pos_belt_colour, "quantity": 1, "price_at_sale": 100}]
            sql(as_staff(auth_user, f"select public.pos_record_sale(gen_random_uuid(),'{actor}',100,'cash',100,{quoted(pos_belt_cart)});"))
            assert sql(f"select stock_quantity from product_colors where id='{pos_belt_colour}';") == "2"
            sale_id, line_id = sql(f"select sale_id,id from pos_sale_items where product_id='{pos_belt}';").split("|")
            items = [{"sale_item_id": line_id, "quantity": 1}]
            sql(as_staff(manager_auth, f"select public.pos_process_return(gen_random_uuid(),'{sale_id}','Fixture return',{quoted(items)});"))
            sql(as_staff(manager_auth, f"select public.pos_manager_adjust_stock(gen_random_uuid(),'{pos_belt}','{pos_belt_colour}',2,'Fixture restock');"))
            assert sql(f"select stock_quantity from product_colors where id='{pos_belt_colour}';") == "5"
            assert sql(f"select count(*) from product_color_sizes where color_id='{pos_belt_colour}';") == "0"

            mode = "sequential last-unit check" if single_backend else "concurrent last-unit check"
            print(f"PostgreSQL import, replay, publication, checkout rollback, sized edits, cancellation, POS belt lifecycle and {mode} passed")
        finally:
            if not single_backend:
                subprocess.run(["pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"], check=True)


if __name__ == "__main__":
    if "--postgres" in sys.argv or "--single-backend" in sys.argv:
        integration(single_backend="--single-backend" in sys.argv)
    else:
        unittest.main()
