import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Load the real catalogue and its local dependencies with an isolated HTTP client.
function loadModule(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", code)(exports, (id) => imports[id] ?? require(id));
  return exports;
}

test("every public product read omits the SKU and requires website publication", async () => {
  const requests = [];
  const published = {
    id: "published", name: "Shoes", slug: "visible-shoe", description: "Shoe",
    category: "shoe", category_id: "shoes", base_price: 500, base_price_usd: null,
    discount_percent: 0, featured: true, created_at: "2026-11-18",
    stock_tracking_mode: "size", active: true, is_website_published: true, barcode: "INTERNAL",
    product_colors: [{
      id: "tan", product_id: "published", color_name: "Tan", color_hex: "#804000",
      sort_order: 0, stock_quantity: 11, product_images: [],
      product_color_sizes: [
        { id: "s46", size_system: "EU", size_label: "46", stock_quantity: 0, archived: false },
        { id: "s40", size_system: "EU", size_label: "40", stock_quantity: 2, archived: false },
        { id: "s44", size_system: "EU", size_label: "44", stock_quantity: 9, archived: true },
      ],
    }],
  };
  const hidden = { ...published, id: "hidden", slug: "hidden-shoe", is_website_published: false };
  const inactive = { ...published, id: "inactive", slug: "inactive-shoe", active: false };
  const categories = [{ id: "shoes", slug: "shoes", name: "Shoes", parent_id: null }];
  const client = createClient("https://fixture.example", "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(input);
        const query = url.searchParams;
        const table = url.pathname.split("/").at(-1);
        requests.push({ table, query });
        const rows = table === "products"
          ? [published, hidden, inactive].filter((row) => ["active", "is_website_published", "slug"].every(
            (field) => !query.has(field) || query.get(field) === `eq.${row[field]}`,
          ))
          : table === "categories"
            ? categories.filter((row) => !query.has("parent_id") || query.get("parent_id") === `eq.${row.parent_id}`)
            : [{ product_id: published.id }, { product_id: hidden.id }];
        return Response.json(rows);
      },
    },
  });
  const mappers = loadModule("lib/mappers.ts", { "@/lib/angles": loadModule("lib/angles.ts") });
  const api = loadModule("lib/api.ts", {
    "@/lib/mappers": mappers,
    "@/lib/mock-data": loadModule("lib/mock-data.ts"),
    "@/lib/product-filters": loadModule("lib/product-filters.ts"),
    "@/lib/supabase/public": { createPublicClient: () => client },
    "@/lib/categories-api": { getCategories: async () => categories.map((row) => ({ ...row, parentId: row.parent_id })) },
  });

  assert.deepEqual((await api.getProducts()).map((item) => item.slug), ["visible-shoe"]);
  assert.equal(await api.getProductBySlug("hidden-shoe"), null);
  const item = await api.getProductBySlug("visible-shoe");
  assert.equal(item.colors[0].stockQuantity, 2);
  const admin = mappers.toAdminProduct(published);
  assert.equal(admin.totalStock, 11);
  assert.equal(admin.colors[0].stockQuantity, 11);
  assert.equal(mappers.productEditSnapshot(published).product.at(-1), "size");
  assert.deepEqual(item.colors[0].sizes.map(({ label, stockQuantity }) => [label, stockQuantity]), [["40", 2], ["46", 0]]);
  assert.equal(Object.hasOwn(item, "barcode"), false);
  assert.deepEqual(item.angles, ["front"]);
  assert.deepEqual(await api.getProductSlugs(), ["visible-shoe"]);
  assert.deepEqual((await api.searchProducts("Shoes")).map((item) => item.slug), ["visible-shoe"]);
  assert.deepEqual((await api.getProductsByCategory("shoes")).map((item) => item.slug), ["visible-shoe"]);
  assert.equal((await api.getCategoryColorOptions("shoes")).length, 1);
  assert.equal((await api.getFeaturedProducts()).length, 1);
  assert.equal((await api.getNewArrivals(2)).length, 1);

  const productRequests = requests.filter(({ table }) => table === "products");
  assert.equal(productRequests.filter(({ query }) => query.get("limit") !== "0").length, 9);
  for (const { query } of productRequests) {
    assert.equal(query.get("active"), "eq.true");
    assert.equal(query.get("is_website_published"), "eq.true");
    assert.doesNotMatch(query.get("select"), /\*|\bbarcode\b|\bqr_code\b/);
  }
});
