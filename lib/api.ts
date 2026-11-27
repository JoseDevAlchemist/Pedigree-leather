import { getCategories } from "@/lib/categories-api";
import { cache } from "react";
import { anglesForCategory, toProduct } from "@/lib/mappers";
import type { ProductWithRelations } from "@/lib/mappers";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import {
  buildProductFilterQuery,
  type CategoryColorOption,
  type ProductFilters,
} from "@/lib/product-filters";
import { createPublicClient } from "@/lib/supabase/public";
import type { Product } from "@/lib/types";

/**
 * ============================================================================
 * The one place the shop reads products from.
 * ============================================================================
 *
 * Components import from here and never from `lib/mock-data.ts`, and never from
 * Supabase. Swapping the backend is a change to this file and nothing else.
 *
 * ---------------------------------------------------------------------------
 * Demo data is available only when explicitly enabled outside production.
 * Catalogue errors in the deployed shop leave the affected results empty.
 *
 * Only explicit anonymous product projections enter the storefront cache.
 * Prices and stock in these projections are display snapshots. Checkout reads
 * authoritative availability and prices through the order reservation RPC.
 */

/** Newest first, comparing as dates so a non-`Z` offset sorts correctly. */
function byCreatedAtDesc(a: Product, b: Product): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function mockProducts(category?: Product["category"]): Product[] {
  if (process.env.NODE_ENV === "production" || process.env.PEDIGREE_DEMO_CATALOGUE !== "1") return [];
  return [...MOCK_PRODUCTS]
    .sort((a, b) => byCreatedAtDesc(a, b))
    .filter((product) => !category || product.category === category)
    .map(withShopColors);
}

/** The same field matching as `searchProducts`, for a database that is down. */
function searchMockProducts(query: string): Product[] {
  const needle = query.toLowerCase();

  return mockProducts().filter((product) => {
    const legacyCategory = product.category === "bag" ? "bags bag" : "shoes shoe";
    return (
      product.name.toLowerCase().includes(needle) ||
      product.description.toLowerCase().includes(needle) ||
      product.colors.some((color) => color.name.toLowerCase().includes(needle)) ||
      legacyCategory.includes(needle)
    );
  });
}

/** Apply the category page's filters to the mock catalogue, for DB-down reads. */
function filterMockProducts(products: Product[], filters: ProductFilters): Product[] {
  const colors = new Set(filters.colors.map((color) => color.toLowerCase()));

  const filtered = products.filter((product) => {
    if (filters.minPrice !== undefined && product.basePrice < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && product.basePrice > filters.maxPrice) {
      return false;
    }
    if (
      colors.size > 0 &&
      !product.colors.some((color) => colors.has(color.name.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered];

  if (filters.sort === "price_asc") {
    sorted.sort(
      (a, b) => a.basePrice - b.basePrice || byCreatedAtDesc(a, b),
    );
  } else if (filters.sort === "price_desc") {
    sorted.sort(
      (a, b) => b.basePrice - a.basePrice || byCreatedAtDesc(a, b),
    );
  } else {
    sorted.sort(byCreatedAtDesc);
  }

  return sorted;
}

/** The shop's old bag/shoe column, for the DB-down mock fallback only. */
function legacyCategoryForSlug(slug: string): Product["category"] | null {
  if (slug === "bags" || slug.includes("bag")) return "bag";
  if (
    slug === "shoes" ||
    slug.includes("shoe") ||
    slug.includes("sneaker")
  ) {
    return "shoe";
  }
  return null;
}

function colorKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function colorLabel(name: string): string {
  return colorKey(name).replace(/\b\w/g, (character) => character.toUpperCase());
}

function addColorOption(
  options: Map<string, CategoryColorOption>,
  name: string,
  hex: string,
) {
  const key = colorKey(name);
  if (!key) return;

  const existing = options.get(key);
  if (existing) {
    if (!existing.values.includes(name)) existing.values.push(name);
    return;
  }

  options.set(key, {
    value: key,
    label: colorLabel(name),
    hex,
    values: [name],
  });
}

function sortColorOptions(
  options: Map<string, CategoryColorOption>,
): CategoryColorOption[] {
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function colorOptionsFromMock(products: Product[]): CategoryColorOption[] {
  const options = new Map<string, CategoryColorOption>();

  for (const product of products) {
    for (const color of product.colors) {
      addColorOption(options, color.name, color.hex);
    }
  }

  return sortColorOptions(options);
}

type CategoryColorRow = {
  product_colors: { color_name: string; color_hex: string }[] | null;
};

/**
 * Resolve a category slug to the ids the product query should cover — the
 * category itself plus its children. `null` means "fall back to mock data";
 * an empty result genuinely means the category page has no products.
 */
const resolveCategoryScope = cache(async (categorySlug: string): Promise<string[] | null> => {
  const categories = await getCategories();
  const category = categories.find(({ slug }) => slug === categorySlug);
  if (!category) return null;

  return [category.id, ...categories.filter(({ parentId }) => parentId === category.id).map(({ id }) => id)];
});

/* Reasons already reported, so a broken database produces one line per *cause*
   rather than one line per render or per slug. A `Set` of strings, module scope:
   this is per-server-process and deliberately not shared. */
const reportedProblems = new Set<string>();

function reportOnce(key: string, message: string) {
  if (reportedProblems.has(key)) return;
  reportedProblems.add(key);
  console.warn(`[pedigree/products] ${message}`);
}

/* One key for "the schema is not there", deliberately *not* including which read
   found it. Every read fails for the same reason and there is one fix, so a deploy
   with no migration should print one line — not one per function, and certainly not one
   per product slug, which is what keying this by label produced. */
const MISSING_SCHEMA_KEY = "schema-missing";

/**
 * True when the failure is "the schema is not there yet" rather than "the
 * database is down". PostgREST says PGRST205; Postgres itself says 42P01 for an
 * undefined table. Both are treated as "migration not run", which is the one case
 * where falling back is definitely the right answer rather than a maybe.
 */
function isMissingSchema(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

async function readFromSupabase(
  label: string,
  run: (supabase: ReturnType<typeof createPublicClient>) => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<ProductWithRelations[] | null> {
  try {
    const supabase = createPublicClient("catalogue");
    const { data, error } = await run(supabase);

    if (error) {
      if (isMissingSchema(error)) {
        reportOnce(
          MISSING_SCHEMA_KEY,
          "Supabase has no `products` table yet, so every read is falling back to " +
            "mock data. The shop will look normal and will be serving mock data. Run " +
            "supabase/migrations/001_initial.sql, then 002_storage.sql, then " +
            "supabase/seed.sql in the Supabase SQL editor — see docs/SETUP.md.",
        );
      } else {
        reportOnce(
          `error:${label}:${error.code ?? error.message ?? "unknown"}`,
          `Supabase read failed (${error.code ?? "no code"}: ${error.message}). ` +
            "Catalogue data unavailable. This is not the same as the migration being " +
            "un-run — check the Supabase project's health and your env vars.",
        );
      }
      return null;
    }

    return (data ?? []) as ProductWithRelations[];
  } catch (error) {
    /* Only one thing here throws, and it is a configuration fault: the client factory
       refuses to build without its two variables. Worth saying so precisely, because
       the earlier version of this message blamed the env vars for anything at all
       that threw — including Next's "couldn't be rendered statically because it used
       `cookies`", which is not a configuration problem and which this read path no
       longer causes anyway (see `lib/supabase/public.ts`). */
    reportOnce(
      `throw:${label}`,
      `Could not create the Supabase client: ${error instanceof Error ? error.message : "unknown error"}. ` +
        "Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, " +
        "and confirm .env.local exists in the build environment, not only on your machine.",
    );
    return null;
  }
}

const PRODUCT_SELECT = "id,name,slug,description,category,category_id,base_price,base_price_usd,discount_percent,featured,created_at,stock_tracking_mode,product_colors!inner(id,product_id,color_name,color_hex,sort_order,stock_quantity,product_color_sizes(id,size_label,size_system,stock_quantity,archived),product_images(id,color_id,angle,image_url,sort_order))";

const COLOUR_PRODUCT_SELECT = "id,name,slug,description,category,category_id,base_price,base_price_usd,discount_percent,featured,created_at,product_colors!inner(id,product_id,color_name,color_hex,sort_order,stock_quantity,product_images(id,color_id,angle,image_url,sort_order))";

const catalogueProjection = cache(async () => {
  // The deployed catalogue uses the verified canonical EU size inventory schema.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === "https://scvscxbxfpjqbqkfkset.supabase.co") {
    return PRODUCT_SELECT;
  }
  const probe = await publicProducts(createPublicClient("catalogue"), PRODUCT_SELECT).limit(0);
  const error = probe.error;
  if ((error?.code === "PGRST200" && error.message.includes("product_color_sizes"))
    || (error?.code === "42703" && error.message.includes("stock_tracking_mode"))) {
    return COLOUR_PRODUCT_SELECT;
  }
  return PRODUCT_SELECT;
});

function publicProducts<Projection extends string>(
  supabase: ReturnType<typeof createPublicClient>,
  projection: Projection,
) {
  return supabase.from("products").select(projection)
    .eq("active", true)
    .eq("is_website_published", true);
}

/** Read category IDs in batches without loading product cards for the shop shell. */
export const getPopulatedSubcategories = cache(async () => {
  const categories = (await getCategories()).filter(({ parentId }) => parentId);
  const remaining = new Set(categories.map(({ id }) => id));
  const populated = new Set<string>();
  const ids = [...remaining];
  const pageSize = 500;

  for (let offset = 0; remaining.size > 0; offset += pageSize) {
    const rows = await readFromSupabase("getPopulatedSubcategories", (supabase) =>
      publicProducts(supabase, "category_id")
        .in("category_id", ids)
        .order("id")
        .range(offset, offset + pageSize - 1),
    );
    if (!rows) break;
    for (const { category_id } of rows) {
      if (category_id && remaining.delete(category_id)) populated.add(category_id);
    }
    if (rows.length < pageSize) break;
  }

  return categories.filter(({ id }) => populated.has(id));
});

function withShopColors(product: Product): Product {
  const available = product.colors.filter((color) => color.stockQuantity > 0);
  return available.length > 0 ? { ...product, colors: available } : product;
}

function toShopProduct(row: ProductWithRelations): Product {
  return withShopColors(toProduct(row));
}

/**
 * All products, newest first. The category filter is optional, and the two
 * category pages pass theirs so a real database query would only ever return one
 * category.
 */
const readPublicProducts = cache(async (category?: Product["category"]) =>
  readFromSupabase(`getProducts:${category ?? "all"}`, async (supabase) => {
    let query = publicProducts(supabase, await catalogueProjection())
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    return query;
  }),
);

export async function getHomepageProducts(category: Product["category"]): Promise<Product[]> {
  return (await readPublicProducts(category) ?? []).map(toShopProduct);
}

export async function getProducts(category?: Product["category"]): Promise<Product[]> {
  const rows = await readPublicProducts(category);
  if (rows === null) return mockProducts(category);
  return rows.map(toShopProduct).sort((a, b) => byCreatedAtDesc(a, b));
}

/** Search all public matching products with one nested product read. */
export async function searchProducts(query: string): Promise<Product[]> {
  const term = query.trim().slice(0, 120);
  if (!term) return [];

  const lower = term.toLowerCase();
  const pattern = `%${term.replace(/[\\%_*]/g, (character) => `\\${character}`)}%`;
  const rows = await readFromSupabase("searchProducts", async (supabase) => {
    const [projection, categories, colours] = await Promise.all([
      catalogueProjection(),
      getCategories(),
      supabase.from("product_colors").select("product_id").ilike("color_name", pattern).limit(500),
    ]);

    const categoryIds = new Set(categories.filter(({ name, slug }) =>
      name.toLowerCase().includes(lower) || slug.toLowerCase().includes(lower),
    ).map(({ id }) => id));
    let addedChild = true;
    while (addedChild) {
      addedChild = false;
      for (const { id, parentId } of categories) {
        if (parentId && categoryIds.has(parentId) && !categoryIds.has(id)) {
          categoryIds.add(id);
          addedChild = true;
        }
      }
    }

    if (colours.error) {
      reportOnce("search:colours", "Search could not load colour matches.");
    }
    const productIds = [...new Set((colours.data ?? []).map(({ product_id }) => product_id))];
    // Quote OR values so punctuation in customer input stays inside the pattern.
    const quoted = JSON.stringify(pattern);
    const filters = [`name.ilike.${quoted}`, `description.ilike.${quoted}`];
    if (categoryIds.size) filters.push(`category_id.in.(${[...categoryIds].map((id) => JSON.stringify(id)).join(",")})`);
    if (productIds.length) filters.push(`id.in.(${productIds.map((id) => JSON.stringify(id)).join(",")})`);

    return publicProducts(supabase, projection)
      .or(filters.join(","))
      .order("created_at", { ascending: false })
      .limit(100)
      .overrideTypes<ProductWithRelations[], { merge: false }>();
  });

  return rows === null ? searchMockProducts(term) : rows.map(toShopProduct);
}

/**
 * A single product by slug, or `null` when it does not exist.
 *
 * `null` is the contract for "not found": the detail page turns it into a 404, so
 * a caller must never return a stub object here.
 */
export const getProductBySlug = cache(async (
  slug: string,
  category?: Product["category"],
): Promise<Product | null> => {
  const rows = await readFromSupabase(`getProductBySlug:${slug}`, async (supabase) => {
    let query = publicProducts(supabase, await catalogueProjection())
      .eq("slug", slug);
    /* The category guard is not redundant with the route: slugs are unique across
       the whole catalogue, so without it a shoe slug resolves on the bags route. */
    if (category) query = query.eq("category", category);
    return query.limit(1);
  });

  if (rows === null) {
    const match = mockProducts().find((product) => product.slug === slug);
    if (!match) return null;
    if (category && match.category !== category) return null;
    return match;
  }

  return rows.length > 0 ? toShopProduct(rows[0]) : null;
});

/**
 * Every slug the shop has, for `generateStaticParams`.
 *
 * Called at build time. Note this deliberately asks for *all* slugs by default:
 * each category route passes its own, and a route that cannot enumerate its
 * products would prerender nothing.
 */
export async function getProductSlugs(category?: Product["category"]): Promise<string[]> {
  const rows = await readFromSupabase(`getProductSlugs:${category ?? "all"}`, (supabase) => {
    let query = publicProducts(supabase, "slug, product_colors!inner(id)");
    if (category) query = query.eq("category", category);
    return query;
  });

  if (rows === null) {
    const products = mockProducts(category);
    return products.map((product) => product.slug);
  }
  return rows.map((row) => (row as { slug: string }).slug);
}

/**
 * All products in a category, optionally filtered by colour and price. Looks up
 * the category by slug, then joins products on `category_id`. A parent category
 * also includes the products filed under its children, so `/category/bags` is
 * "everything in Bags" rather than only the products assigned to the parent row.
 *
 * Colour filtering is deliberately two reads: PostgREST's embedded-resource
 * filter does not select parent rows without `!inner`, and `!inner` would then
 * return only the matching colourways. Reading the matching product ids first
 * keeps every card's full swatch set intact.
 *
 * Falls back to mock data filtered by the legacy `category` column when the
 * schema is not yet available.
 */
export async function getProductsByCategory(
  categorySlug: string,
  filters: ProductFilters = { colors: [], sort: "newest" },
): Promise<Product[]> {
  const fallback = () => {
    const legacyCategory = legacyCategoryForSlug(categorySlug);
    return filterMockProducts(
      legacyCategory ? mockProducts(legacyCategory) : [],
      filters,
    );
  };

  let supabase: ReturnType<typeof createPublicClient>;
  try {
    supabase = createPublicClient("catalogue");
  } catch (error) {
    reportOnce(
      "category:client",
      `Could not create the Supabase client for category products: ${
        error instanceof Error ? error.message : "unknown error"
      }. Catalogue data unavailable.`,
    );
    return fallback();
  }

  const categoryIds = await resolveCategoryScope(categorySlug);
  if (categoryIds === null) return fallback();

  let colorProductIds: string[] | null = null;

  if (filters.colors.length > 0) {
    const { data: colorRows, error: colorError } = await supabase
      .from("product_colors")
      .select("product_id")
      .in("color_name", filters.colors);

    if (colorError) {
      reportOnce(
        `error:getProductsByCategory:colors:${colorError.code ?? colorError.message ?? "unknown"}`,
        `Could not read colour filters (${colorError.code ?? "no code"}: ${colorError.message}). Catalogue data unavailable.`,
      );
      return fallback();
    }

    colorProductIds = [
      ...new Set(
        ((colorRows ?? []) as { product_id: string }[]).map(
          (row) => row.product_id,
        ),
      ),
    ];

    /* No product has the selected colours: skip the products query entirely. */
    if (colorProductIds.length === 0) return [];
  }

  const filterKey = buildProductFilterQuery(filters);

  const rows = await readFromSupabase(
    `getProductsByCategory:${categorySlug}:${filterKey}`,
    async (supabase) => {
      let query = publicProducts(supabase, await catalogueProjection())
        .in("category_id", categoryIds);

      if (colorProductIds) {
        query = query.in("id", colorProductIds);
      }

      if (filters.minPrice !== undefined) {
        query = query.gte("base_price", filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte("base_price", filters.maxPrice);
      }

      if (filters.sort === "price_asc") {
        return query
          .order("base_price", { ascending: true })
          .order("created_at", { ascending: false });
      }

      if (filters.sort === "price_desc") {
        return query
          .order("base_price", { ascending: false })
          .order("created_at", { ascending: false });
      }

      return query.order("created_at", { ascending: false });
    },
  );

  if (rows === null) return fallback();

  /* Keep the database order: it already reflects the requested sort. */
  return rows.map(toShopProduct);
}

/**
 * The colour checkboxes for a category page, scoped to that category and its
 * children. Grouping is case-insensitive because the live catalogue contains
 * both `Brown` and `brown`; the returned `values` carry every stored spelling so
 * selecting one checkbox still filters both.
 */
export async function getCategoryColorOptions(
  categorySlug: string,
): Promise<CategoryColorOption[]> {
  const fallback = () => {
    const legacyCategory = legacyCategoryForSlug(categorySlug);
    return colorOptionsFromMock(
      legacyCategory ? mockProducts(legacyCategory) : [],
    );
  };

  let supabase: ReturnType<typeof createPublicClient>;
  try {
    supabase = createPublicClient("catalogue");
  } catch (error) {
    reportOnce(
      "category-colors:client",
      `Could not create the Supabase client for category colours: ${
        error instanceof Error ? error.message : "unknown error"
      }. Catalogue data unavailable.`,
    );
    return fallback();
  }

  const categoryIds = await resolveCategoryScope(categorySlug);
  if (categoryIds === null) return fallback();

  const { data, error } = await publicProducts(supabase, "product_colors!inner(color_name, color_hex)")
    .in("category_id", categoryIds);

  if (error) {
    reportOnce(
      `error:getCategoryColorOptions:${error.code ?? error.message ?? "unknown"}`,
      `Could not read category colours (${error.code ?? "no code"}: ${error.message}). Catalogue data unavailable.`,
    );
    return fallback();
  }

  const options = new Map<string, CategoryColorOption>();

  for (const product of (data ?? []) as CategoryColorRow[]) {
    for (const color of product.product_colors ?? []) {
      addColorOption(options, color.color_name, color.color_hex);
    }
  }

  return sortColorOptions(options);
}

/**
 * The home page's "Featured" rail.
 *
 * Manual curation, not a ranking: a product is in here because somebody set
 * `featured` on it in the admin. The home page never reorders or re-picks these
 * slots, so a bag stays at the front of the rail for as long as it is featured.
 * Deliberately unfiltered by category — the rail is the shop's front door and shows
 * both bags and shoes.
 *
 * FUTURE: once more than a handful of products are featured the admin needs a rank
 * column, because `featured = true` alone has no stable order.
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  const rows = await readFromSupabase("getFeaturedProducts", async (supabase) =>
    publicProducts(supabase, await catalogueProjection())
      .eq("featured", true)
      .order("created_at", { ascending: false }),
  );

  if (rows === null) return mockProducts().filter((product) => product.featured);
  return rows.map(toShopProduct).sort((a, b) => byCreatedAtDesc(a, b));
}

/**
 * The home page's "New Arrivals" grid.
 *
 * Automatic by construction — newest by `createdAt`, cut to `limit`. There is no
 * cron and no daily shuffle: a product reaches this list the moment it is created
 * and falls off it only when `limit` newer products have pushed it out. Freshness
 * comes from new stock, not from rotation.
 */
export async function getNewArrivals(limit: number): Promise<Product[]> {
  const rows = await readFromSupabase(`getNewArrivals:${limit}`, async (supabase) =>
    publicProducts(supabase, await catalogueProjection())
      .order("created_at", { ascending: false })
      .limit(Math.max(0, limit)),
  );

  if (rows === null) return mockProducts().slice(0, Math.max(0, limit));
  return rows.map(toShopProduct);
}

/**
 * The views a product of this category is photographed from.
 *
 * Re-exported rather than imported from `lib/angles.ts` by the pages, so that
 * "what is a product" has exactly one entry point.
 */
export { anglesForCategory };
