"""Verify the checked-in eight seed files against the source workbook."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "supabase/seeds/item-push"
WORKBOOK = ROOT / "Pedigree Updated Stock Sheet Shared Copy.xlsx"
sys.path.insert(0, str(ROOT / "scripts"))

from catalogue_import_preview import make_preview
from prepare_item_push_seeds import DESCRIPTION, prepare_manifest, seed_sql


def real_manifest():
    return prepare_manifest(make_preview(WORKBOOK.read_bytes()))


class ItemPushSeedTest(unittest.TestCase):
    def setUp(self):
        self.manifest = real_manifest()
        self.batches = self.manifest["batches"]

    def test_products_units_and_source_coverage(self):
        self.assertEqual(len(self.batches), 8)
        totals = [batch["counts"] for batch in self.batches]
        self.assertEqual(sum(row["source_rows"] for row in totals), 142)
        self.assertEqual(sum(row["distinct_coded_candidates"] for row in totals), 110)
        self.assertEqual(sum(row["known_numeric_units"] or 0 for row in totals), 768)
        self.assertEqual(sum(row["seed_products"] for row in totals), 80)
        self.assertEqual(sum(row["seed_units"] for row in totals), 671)
        self.assertEqual([row["known_numeric_units"] for row in totals], [None, 59, 70, 88, 351, None, 30, 170])
        self.assertEqual(self.manifest["approved_batches"], [])
        self.assertEqual(self.manifest["image_rows_to_create"], 0)
        self.assertEqual(self.manifest["photo_angles"], ["front", "back", "side-left", "side-right", "top"])

    def test_representative_products_and_exceptions(self):
        products = {item["code"]: item for batch in self.batches for item in batch["ready_products"]}
        held = {item["code"]: item for batch in self.batches for item in batch["held_candidates"] if item["code"]}
        self.assertEqual(products["LB-532"]["name"], "Not Named")
        self.assertEqual(products["LB-532"]["base_price"], 12850)
        self.assertEqual(len(products["LB-532"]["colours"]), 4)
        self.assertEqual(products["LB-532"]["known_numeric_units"], 5)
        self.assertEqual(products["LB-2207"]["known_numeric_units"], 24)
        self.assertEqual(len(products["LB-2207"]["colours"]), 6)
        shoe = products["SS-G107"]
        self.assertEqual({colour["name"] for colour in shoe["colours"]}, {"Black", "Brown"})
        self.assertTrue(any(size["quantity"] == 0 for colour in shoe["colours"] for size in colour["sizes"]))
        self.assertIn("invalid_quantity", held["LSS-99051"]["review_issues"])
        self.assertIn("]", (DIRECTORY / "99-exceptions.csv").read_text())
        self.assertIsNone(held["PH 3459"]["base_price"])
        self.assertIn("duplicate_code_requires_resolution", held["PH 2126"]["review_issues"])
        self.assertEqual(held["LSS-2125"]["name"], "Not Named")
        self.assertEqual(held["LSS-2125"]["base_price"], 14200)
        self.assertIsNone(held["LSS-2125"]["known_numeric_units"])
        self.assertEqual(held["LB-A219"]["colours"], [])
        self.assertTrue(all(item["description"] == DESCRIPTION for item in [*products.values(), *held.values()]))

    def test_checked_in_seed_files_match_the_workbook(self):
        saved = json.loads((DIRECTORY / "00-manifest.json").read_text())
        for batch, saved_batch in zip(self.batches, saved["batches"], strict=True):
            self.assertEqual(batch["prepared_batch_id"], saved_batch["prepared_batch_id"])
            expected = seed_sql(batch, self.manifest["workbook_sha256"])
            self.assertEqual(expected, (DIRECTORY / batch["file"]).read_text())
            self.assertEqual(hashlib.sha256(expected.encode()).hexdigest(), saved_batch["sql_sha256"])
        shared = (DIRECTORY / "00-apply-prepared-batch.sql").read_bytes()
        self.assertEqual(hashlib.sha256(shared).hexdigest(), saved["shared_sql_sha256"])


def disposable_sql_test():
    """Run only the seed workflow, on a fresh local PostgreSQL data directory."""
    pos = ROOT.parent / "posversion2" / "supabase/migrations"
    fixture = (ROOT / "tests/catalogue-stock.fixture.sql").read_text().split("-- Website-specific fixture")[0]
    with tempfile.TemporaryDirectory(prefix="item-push-pg-") as data:
        subprocess.run(["initdb", "-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"],
                       check=True, stdout=subprocess.DEVNULL)

        def sql(statement, error=None):
            source = "\n".join(line for line in statement.splitlines() if line.strip())
            process = subprocess.run(["postgres", "--single", "-j", "-D", data, "postgres"],
                                     input=source + "\n\n", text=True, capture_output=True, timeout=45)
            errors = [line for line in process.stderr.splitlines() if "ERROR:" in line or "FATAL:" in line]
            if error:
                assert any(error in line for line in errors), errors
            else:
                assert process.returncode == 0 and not errors, errors
            return re.findall(r'^.*? = "(.*)"\t', process.stdout, flags=re.M)

        sql(fixture)
        for path in sorted(pos.glob("*.sql")):
            if path.name <= "20261118130000_pos_size_inventory.sql":
                sql(path.read_text())
        sql("""
            create table public.categories (id uuid primary key default gen_random_uuid(),
              slug text unique not null, parent_id uuid references public.categories, is_active boolean not null);
            insert into public.categories(slug,is_active) values ('bags',true),('shoes',true),('belts',true);
            alter table public.products add column category_id uuid references public.categories;
        """)
        sql((ROOT / "docs/sql/catalogue-excel-import.review.sql").read_text())
        shared = (DIRECTORY / "00-apply-prepared-batch.sql").read_text()
        batches = real_manifest()["batches"]

        def seed(batch, approval=None):
            script = (DIRECTORY / batch["file"]).read_text()
            script = script.replace(r"\ir 00-apply-prepared-batch.sql", shared)
            script = "\n".join(line for line in script.splitlines() if not line.startswith(r"\set"))
            return script.replace(":'approved_batch_id'", "'" + (approval or batch["prepared_batch_id"]) + "'").replace(
                ":'verified_project_ref'", "'abcdefghijklmnopqrst'"
            ).replace(":'shoe_size_system'", "'Fixture system'")

        sql(seed(batches[1], "wrong"), "item_push_batch_approval_required")
        assert sql("select count(*) from products;") == ["0"]
        for batch in batches:
            sql(seed(batch))
        assert sql("select count(*), sum(stock_quantity) from products;") == ["80", "671"]
        assert sql("select count(*) from products where active or publish_to_pos or is_website_published;") == ["0"]
        assert sql("select count(*) from products p join categories c on c.id=p.category_id where c.parent_id is not null;") == ["0"]
        assert sql("select count(*) from product_images;") == ["0"]
        assert sql("select count(*) from excel_catalogue_batch_audit where outcome='IMPORTED';") == ["80"]
        sql("""
            update public.product_colors set stock_quantity = stock_quantity - 1
            where product_id = (select id from public.products where barcode='LB-532') and color_name='Black';
        """)
        for batch in batches:
            sql(seed(batch))
        assert sql("select count(*), sum(stock_quantity) from products;") == ["80", "670"]
        assert sql("select count(*) from excel_catalogue_batch_audit where outcome='IMPORTED';") == ["80"]
        print("All eight generated seeds passed on disposable PostgreSQL, including approval refusal and replay after stock change.")


if __name__ == "__main__":
    if "--single-backend" in sys.argv:
        disposable_sql_test()
    else:
        unittest.main()
