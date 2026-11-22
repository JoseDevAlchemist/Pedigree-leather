"""Run with PostgreSQL tools on PATH. Creates its own disposable cluster."""
import json
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
PRODUCT = "00000000-0000-4000-8000-000000000001"
COLOUR = "00000000-0000-4000-8000-000000000010"
OTHER = "00000000-0000-4000-8000-000000000002"

with tempfile.TemporaryDirectory(prefix="website-edit-pg-") as cluster:
    work = Path(cluster)
    data = work / "data"
    subprocess.run(["initdb", "-D", data, "--auth=trust", "--no-locale"], check=True)
    try:
        subprocess.run([
            "pg_ctl", "-D", data, "-l", work / "server.log",
            "-o", f"-k {work} -c listen_addresses=''", "-w", "start",
        ], check=True)
    except subprocess.CalledProcessError:
        print((work / "server.log").read_text())
        raise

    try:
        psql = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", cluster, "-d", "postgres"]

        def sql(statement):
            result = subprocess.run(psql, input=statement, text=True, capture_output=True, timeout=10)
            assert result.returncode == 0, result.stderr
            return result.stdout.strip()

        fixture = (ROOT / "tests/website-edit-product.test.sql").read_text()
        sql(fixture.split(r"\ir ", 1)[0])
        sql((ROOT / "docs/sql/website-edit-product.review.sql").read_text())
        sql(f"""
            insert into products select '{OTHER}', 'Other', 'other', description, category,
              category_id, base_price, base_price_usd, null, publish_to_pos, discount_percent,
              featured, active, is_website_published, 0, stock_tracking_mode from products where id='{PRODUCT}';
        """)
        colors = json.loads(sql(f"""
            select jsonb_agg(jsonb_build_object('id',c.id,'name',c.color_name,'hex',c.color_hex,
              'order',c.sort_order,'images',(select coalesce(jsonb_agg(jsonb_build_object(
                'id',i.id,'angle',i.angle,'url',i.image_url,'order',i.sort_order) order by i.id),'[]')
                from product_images i where i.color_id=c.id)) order by c.id)
            from product_colors c where product_id='{PRODUCT}';
        """))
        draft = {
            "expected": {
                "product": ["Bag", "bag", "Leather", "bag", None, 400, None, "B-1", True, 0, False, True, False, "color"],
                "colors": colors,
            },
            "name": "Bag", "slug": "bag", "description": "Leather", "category": "bag",
            "categoryId": None, "basePrice": 400, "barcode": "B-1", "publishToPos": True,
            "discountPercent": 0, "featured": False, "active": True,
            "colors": json.loads(json.dumps(colors)),
        }
        draft["colors"][0]["images"][0]["url"] += "?v=concurrent"

        with subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True) as website:
            website.stdin.write(
                f"begin; set role service_role; select website_edit_product('{PRODUCT}',"
                + "$draft$" + json.dumps(draft) + "$draft$);\n"
            )
            website.stdin.flush()
            try:
                assert website.stdout.readline().strip() == PRODUCT
                sql(f"""
                    set lock_timeout='500ms';
                    begin;
                    select id from products where id='{OTHER}' for update;
                    insert into pos_card_payments values ('[]');
                    insert into pos_mpesa_sales values ('[]');
                    insert into pos_quotations values ('[]');
                    commit;
                """)
                # Mirrors POS settlement's payment-row → product → colour lock order.
                with subprocess.Popen(
                    psql + ["-c", f"""/* website-edit-fixture: settlement */
                        begin;
                        select * from pos_card_payments for update;
                        select id from products where id='{PRODUCT}' for update;
                        select id from product_colors where id='{COLOUR}' for update;
                        insert into pos_sale_items values ('{COLOUR}');
                        update product_colors set stock_quantity=stock_quantity-1 where id='{COLOUR}';
                        commit;"""],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                ) as settlement:
                    try:
                        for _ in range(50):
                            if sql("""
                                select exists(select 1 from pg_stat_activity
                                where query like '/* website-edit-fixture: settlement */%'
                                and cardinality(pg_blocking_pids(pid)) > 0);
                            """) == "t":
                                break
                            time.sleep(0.05)
                        else:
                            raise AssertionError("Settlement did not wait for the product lock")
                        sql("set lock_timeout='500ms'; insert into pos_quotations values ('[]');")
                    finally:
                        website.stdin.write("commit;\n")
                        website.stdin.flush()
                    _, errors = settlement.communicate(timeout=5)
                    assert settlement.returncode == 0, errors
            finally:
                website.stdin.close()

        assert sql(f"select stock_quantity from product_colors where id='{COLOUR}';") == "3"
        assert sql(f"select image_url like '%?v=concurrent' from product_images where color_id='{COLOUR}' and angle='front';") == "t"
        print("Concurrent website edit, sale, payment and quotation lock fixture passed.")
    finally:
        subprocess.run(["pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"], check=True)
