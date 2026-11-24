"""Isolated synthetic OOXML tests for the read-only preview."""

from io import BytesIO
from pathlib import Path
import sys
import unittest
from xml.sax.saxutils import escape
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from catalogue_import_preview import make_preview


def fixture(extra=None):
    vn = {
        "B2": "Product Name", "C2": "Pedigree Code", "D2": "Selling Price Inc. VAT",
        "B4": " Fractional price ", "C4": "PH-1", "D4": 1.5,
        "B5": "Same code", "C5": " ph-1 ", "D5": 0,
    }
    cn = {
        "B2": "Product Name", "C2": "Code", "D2": "Pedigree Code",
        "AT2": "Selling Price Inc. VAT", "AS4": "Total Quantity",
        "B103": "Lihua Belts", "B106": "New Hua Cai Shoes",
        "H106": "Brown", "L106": "Light Brown",
        "B19": "Shoe", "C19": "Blue", "D19": "000123", "AT19": 100,
        "H19": 1, "L19": 0, "AS19": 2,
        "C20": "Red", "AT20": 100, "H20": 3,
        "B26": "Shoe 2", "D26": "000124", "AT26": 100,
        "N26": "]", "O26": 2,
        "D59": "Bag code", "B59": "Bag name", "H59": 4, "AT59": 33,
        "AS59": ("SUM(E59:AR59)", 3), "AS102": ("SUM(AS59:AS101)", 3),
        "D107": "Style-1", "H107": 5,
    }
    for col in "E F G H I J K L M N O P Q R S T U V W X Y Z AA AB AC AD AE AF AG AH AI AJ AK AL AM AN AO AP AQ AR".split():
        cn[col + "4"] = "Colour " + col
    for header in (18, 38, 111):
        for col, size in zip(("E", "H", "L", "N", "O", "R", "S", "AS"), range(39, 47)):
            cn[col + str(header)] = size
    cn.update(extra or {})

    def sheet(cells, merges):
        content = []
        for ref, val in cells.items():
            if isinstance(val, str):
                content.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(val)}</t></is></c>')
            elif isinstance(val, tuple):
                content.append(f'<c r="{ref}"><f>{val[0]}</f><v>{val[1]}</v></c>')
            else:
                content.append(f'<c r="{ref}"><v>{val}</v></c>')
        merge_xml = "".join(f'<mergeCell ref="{m}"/>' for m in merges)
        return "<worksheet><sheetData><row>" + "".join(content) + "</row></sheetData>" + (
            f"<mergeCells>{merge_xml}</mergeCells></worksheet>"
        )

    payload = BytesIO()
    with ZipFile(payload, "w") as book:
        book.writestr("xl/workbook.xml", """<workbook xmlns:r="urn:test"><sheets>
           <sheet name="VN" r:id="one"/><sheet name="CN Working Sheet" r:id="two"/>
           </sheets></workbook>""")
        book.writestr("xl/_rels/workbook.xml.rels", """<Relationships>
           <Relationship Id="one" Target="worksheets/vn.xml"/>
           <Relationship Id="two" Target="/xl/worksheets/cn.xml"/>
           </Relationships>""")
        book.writestr("xl/worksheets/vn.xml", sheet(vn, []))
        book.writestr("xl/worksheets/cn.xml", sheet(cn, ["B19:B20", "D19:D20"]))
    return payload.getvalue()


class CataloguePreviewTest(unittest.TestCase):
    def setUp(self):
        self.payload = fixture()
        self.preview = make_preview(self.payload)

    def row(self, name, number):
        return next(row for row in self.preview["records"] if (row["sheet"], row["row"]) == (name, number))

    def test_merged_variants_preserve_identity_size_and_zero(self):
        shoe = self.row("CN Working Sheet", 20)
        self.assertEqual((shoe["pedigree_code"], shoe["code_cell"], shoe["colour"]), ("000123", "D19", "Red"))
        stock = self.row("CN Working Sheet", 19)["inventory"]
        self.assertEqual([(cell["size"], cell["quantity"]) for cell in stock], [("40", 1), ("41", 0), ("46", 2)])
        groups = self.preview["code_groups"]
        self.assertEqual({group["kind"] for group in groups}, {"merged_workbook_colour_rows", "duplicate_explicit_code"})

    def test_bad_values_and_subtotal_are_explicit(self):
        invalid = self.row("CN Working Sheet", 26)
        self.assertEqual(invalid["review_cells"], ["N26"])
        self.assertEqual(invalid["numeric_units"], 2)
        row = self.row("CN Working Sheet", 107)
        self.assertIsNone(row["inventory"][0]["size"])
        self.assertIn("footwear_quantity_without_size", row["issues"])
        self.assertEqual(self.row("VN", 4)["recorded_name"], " Fractional price ")
        self.assertIn("invalid_catalogue_price", self.row("VN", 4)["issues"])
        self.assertIn("zero_price", self.row("VN", 5)["issues"])
        self.assertIn("row_total_mismatch_or_missing", self.row("CN Working Sheet", 59)["issues"])
        self.assertEqual(self.preview["section_reconciliation"]["CN Working Sheet 59-101"]["subtotal_difference"], 1)
        source = self.preview["raw_sheets"]["CN Working Sheet"]["cells"]["AS59"]
        self.assertEqual((source["formula"], source["value"]), ("SUM(E59:AR59)", "3"))

    def test_repeatable_preview_and_unpublished_proposal(self):
        self.assertEqual(self.preview, make_preview(self.payload))
        candidate = next(item for item in self.preview["coded_candidates"] if item["identity_key"] == "000123")
        self.assertEqual(candidate["disposition"], "staging_match_required")
        self.assertEqual(candidate["source_rows"], [["CN Working Sheet", 19], ["CN Working Sheet", 20]])
        self.assertFalse(any(candidate["candidate_new_product"][field]
                             for field in ("active", "publish_to_pos", "is_website_published")))
        self.assertEqual(self.preview["totals"]["database_writes"], 0)
        self.assertIsNone(self.preview["totals"]["catalogue_create_update"])

    def test_layout_changes_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Unclassified populated row"):
            make_preview(fixture({"B127": "unexpected"}))
        with self.assertRaisesRegex(ValueError, "Unexpected size headers"):
            make_preview(fixture({"E18": 38}))


if __name__ == "__main__":
    unittest.main()
