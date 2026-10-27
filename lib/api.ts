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
 * FALLBACK TO MOCK DATA — AND WHY IT IS HERE
 * ---------------------------------------------------------------------------
 * Every read below tries Supabase first and falls back to `MOCK_PRODUCTS` if the
 * read fails. That is not a stub, and it is not laziness: at the time this was
 * written the migration in `supabase/migrations/001_initial.sql` had not been run,
 * so `products` did not exist and PostgREST answered every query with PGRST205.
 * Without a fallback, that would have made the shop's front page, the grids, and
 * all twelve detail pages throw — the client would have gone dark for want of a
 * database that is one paste away from existing.
 *
 * So the fallback is load-bearing until the migration lands. The properties that
 * matter:
 *
 *   - **It is loud.** Every distinct reason is logged once with an actionable
 *     message. Silence would be the real failure here.
 *   - **It self-heals.** There is no flag to flip and nothing to redeploy. The
 *     moment the migration runs, the next request reads from Supabase and the
 *     fallback stops being used. Re-running a build is enough.
 *   - **It is one block.** `readFromSupabase` returning `null` is the whole
 *     mechanism, so removing the fallback later is deleting one function and its
 *     five call sites' `?? mock` — not an audit of the file.
 *
 * Once the migration is applied, delete `mockFallback` and make
 * `readFromSupabase` throw instead of returning null. That is a deliberate
 * follow-up, tracked in docs/ADMIN_INTEGRATION_TODO.md, so that a missing row
 * eventually fails loudly rather than quietly rendering nothing.
 *
 * ---------------------------------------------------------------------------
 * Caching
 * ---------------------------------------------------------------------------
 * These reads are mostly static-page reads, so they happen at build time and are
 * baked into the prerendered HTML — the route list should show `○` for `/`,
 * `/bags`, `/shoes` and the product pages. The filtered `/category/[slug]` reads
 * are request-time because the filter state lives in the URL. A product added in
 * the admin gets its page on request (`dynamicParams` defaults to true) but does
 * not appear in an already built grid until the next build. That is the right trade
 * for a shop whose catalogue changes a few times a month, and the wrong one the
 * moment it changes hourly — the fix is a `revalidateTag` call, and
 * `lib/actions/products.ts` already calls `revalidatePath` for the shop routes after
 * every write, so a `next build` is not the only way they update.
 *
 * If any of those routes ever shows up as `ƒ` in the build output, something on this
 * path has started calling `cookies()`. That is what happened when these reads used
 * the session-aware client instead of `lib/supabase/public.ts`, and it is the single
 * thing to check.
 */

/** Newest first, comparing as dates so a non-`Z` offset sorts correctly. */
function byCreatedAtDesc(a: Product, b: Product): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function mockProducts(category?: Product["category"]): Product[] {
  const sorted = [...MOCK_PRODUCTS].sort((a, b) => byCreatedAtDesc(a, b));
  return category ? sorted.filter((p) => p.category === category) : sorted;
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
async function resolveCategoryScope(
  supabase: ReturnType<typeof createPublicClient>,
  categorySlug: string,
): Promise<string[] | null> {
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (categoryError) {
    if (isMissingSchema(categoryError)) {
      reportOnce(
        MISSING_SCHEMA_KEY,
        "Supabase has no `categories` table yet, so category pages are falling back to mock data. Run supabase/migrations/021_categories_reconcile.sql, then the shop will read from Supabase.",
      );
    } else {
      reportOnce(
        `error:resolveCategoryScope:${categoryError.code ?? categoryError.message ?? "unknown"}`,
        `Supabase read failed (${categoryError.code ?? "no code"}: ${categoryError.message}). Falling back to mock data.`,
      );
    }
    return null;
  }

  if (!category) return null;

  const categoryId = (category as { id: string }).id;

  /* One level of children, which is the shape the categories table models. If
     this read fails we still show the parent's own products: an incomplete grid
     beats no grid, and the cause is logged once. */
  const { data: children, error: childrenError } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", categoryId);

  if (childrenError) {
    reportOnce(
      `error:resolveCategoryScope:children:${childrenError.code ?? childrenError.message ?? "unknown"}`,
      `Could not read child categories (${childrenError.code ?? "no code"}: ${childrenError.message}). Showing only products assigned directly to the parent.`,
    );
  }

  return [
    categoryId,
    ...((children ?? []) as { id: string }[]).map((child) => child.id),
  ];
}


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
    const supabase = createPublicClient();
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
            "Falling back to mock data. This is not the same as the migration being " +
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

/**
 * The select that builds a product with its colours and their photographs.
 *
 * Written once because getting it subtly wrong is easy and looks like missing data
 * rather than like a bug: forgetting `product_images` yields a product whose
 * colourways all render the same placeholder, and forgetting the sort columns
 * yields colours in a stable-looking but arbitrary order.
 */
const PRODUCT_SELECT = "*, product_colors(*, product_images(*))";

/**
 * All products, newest first. The category filter is optional, and the two
 * category pages pass theirs so a real database query would only ever return one
 * category.
 */
export async function getProducts(category?: Product["category"]): Promise<Product[]> {
  const rows = await readFromSupabase(`getProducts:${category ?? "all"}`, (supabase) => {
    let query = supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    return query;
  });

  if (rows === null) return mockProducts(category);
  return rows.map(toProduct).sort((a, b) => byCreatedAtDesc(a, b));
}

/**
 * Search products by name, description, category, or colour name.
 *
 * PostgREST cannot express one `OR` across a parent table and an embedded
 * relation reliably, so this runs the matching reads separately and merges the
 * product ids. That also keeps user input out of a hand-built `.or()` string:
 * each term goes through the query builder's value encoding.
 *
 * The category match expands to children, so "bags" finds products filed under
 * "Laptop Bags" and "Handbags" too. Colour matching is a plain ILIKE, which is
 * what makes "brown" find a colour stored as "Cognac Brown".
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const term = query.trim().slice(0, 120);
  if (!term) return [];

  const pattern = `%${term}%`;
  const lower = term.toLowerCase();

  let supabase: ReturnType<typeof createPublicClient>;
  try {
    supabase = createPublicClient();
  } catch (error) {
    reportOnce(
      "search:client",
      `Could not create the Supabase client for search: ${
        error instanceof Error ? error.message : "unknown error"
      }. Falling back to mock search.`,
    );
    return searchMockProducts(term);
  }

  type SearchCategoryRow = {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
  };

  const [nameResult, descriptionResult, colorResult, categoryResult] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .ilike("name", pattern)
      .eq("active", true)
      .limit(100),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .ilike("description", pattern)
      .eq("active", true)
      .limit(100),
    supabase
      .from("product_colors")
      .select("product_id")
      .ilike("color_name", pattern)
      .limit(500),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .eq("is_active", true),
  ]);

  let failed = 0;
  let succeeded = 0;

  const note = (
    label: string,
    error: { code?: string; message?: string } | null,
  ) => {
    if (!error) {
      succeeded += 1;
      return;
    }

    failed += 1;

    if (isMissingSchema(error)) {
      reportOnce(
        `search:missing-schema:${label}`,
        `Search could not read ${label} because a table is missing. Run supabase/migrations/021_categories_reconcile.sql if the categories table is absent.`,
      );
      return;
    }

    reportOnce(
      `search:error:${label}:${error.code ?? error.message ?? "unknown"}`,
      `Search read failed for ${label} (${error.code ?? "no code"}: ${error.message}). Partial results will be shown.`,
    );
  };

  note("name", nameResult.error);
  note("description", descriptionResult.error);
  note("colors", colorResult.error);
  note("categories", categoryResult.error);

  /* If every read failed, the shop is better served by the same mock catalogue
     the rest of `lib/api.ts` falls back to than by an empty results page. */
  if (failed > 0 && succeeded === 0) return searchMockProducts(term);

  const categories = (categoryResult.data ?? []) as SearchCategoryRow[];
  const categoryIds = new Set(
    categories
      .filter(
        (category) =>
          category.name.toLowerCase().includes(lower) ||
          category.slug.toLowerCase().includes(lower),
      )
      .map((category) => category.id),
  );

  /* A parent match includes its children, so searching "bags" finds the
     products filed under "Laptop Bags" and "Handbags" as well. The loop also
     handles a deeper tree without assuming exactly two levels. */
  let addedChild = true;
  while (addedChild) {
    addedChild = false;
    for (const category of categories) {
      if (
        category.parent_id &&
        categoryIds.has(category.parent_id) &&
        !categoryIds.has(category.id)
      ) {
        categoryIds.add(category.id);
        addedChild = true;
      }
    }
  }

  const colorProductIds = [
    ...new Set(
      ((colorResult.data ?? []) as { product_id: string }[]).map(
        (row) => row.product_id,
      ),
    ),
  ];

  const emptyResult = Promise.resolve({ data: [], error: null });
  const [categoryProducts, colorProducts] = await Promise.all([
    categoryIds.size > 0
      ? supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .in("category_id", [...categoryIds])
          .eq("active", true)
          .limit(100)
      : emptyResult,
    colorProductIds.length > 0
      ? supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .in("id", colorProductIds)
          .eq("active", true)
          .limit(100)
      : emptyResult,
  ]);

  note("category products", categoryProducts.error);
  note("colour products", colorProducts.error);

  const byId = new Map<string, ProductWithRelations>();
  const batches = [
    nameResult.data,
    descriptionResult.data,
    categoryProducts.data,
    colorProducts.data,
  ];

  for (const batch of batches) {
    for (const row of (batch ?? []) as ProductWithRelations[]) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  return [...byId.values()].map(toProduct).sort(byCreatedAtDesc);
}

/**
 * A single product by slug, or `null` when it does not exist.
 *
 * `null` is the contract for "not found": the detail page turns it into a 404, so
 * a caller must never return a stub object here.
 */
export async function getProductBySlug(
  slug: string,
  category?: Product["category"],
): Promise<Product | null> {
  const rows = await readFromSupabase(`getProductBySlug:${slug}`, (supabase) => {
    let query = supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug);
    /* The category guard is not redundant with the route: slugs are unique across
       the whole catalogue, so without it a shoe slug resolves on the bags route. */
    if (category) query = query.eq("category", category);
    return query.limit(1);
  });

  if (rows === null) {
    const match = MOCK_PRODUCTS.find((product) => product.slug === slug);
    if (!match) return null;
    if (category && match.category !== category) return null;
    return match;
  }

  return rows.length > 0 ? toProduct(rows[0]) : null;
}

/**
 * Every slug the shop has, for `generateStaticParams`.
 *
 * Called at build time. Note this deliberately asks for *all* slugs by default:
 * each category route passes its own, and a route that cannot enumerate its
 * products would prerender nothing.
 */
export async function getProductSlugs(category?: Product["category"]): Promise<string[]> {
  const rows = await readFromSupabase(`getProductSlugs:${category ?? "all"}`, (supabase) => {
    let query = supabase.from("products").select("slug");
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
    supabase = createPublicClient();
  } catch (error) {
    reportOnce(
      "category:client",
      `Could not create the Supabase client for category products: ${
        error instanceof Error ? error.message : "unknown error"
      }. Falling back to mock data.`,
    );
    return fallback();
  }

  const categoryIds = await resolveCategoryScope(supabase, categorySlug);
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
        `Could not read colour filters (${colorError.code ?? "no code"}: ${colorError.message}). Falling back to mock data.`,
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
    (supabase) => {
      let query = supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("category_id", categoryIds)
        .eq("active", true);

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
  return rows.map((row) => toProduct(row));
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
    supabase = createPublicClient();
  } catch (error) {
    reportOnce(
      "category-colors:client",
      `Could not create the Supabase client for category colours: ${
        error instanceof Error ? error.message : "unknown error"
      }. Falling back to mock data.`,
    );
    return fallback();
  }

  const categoryIds = await resolveCategoryScope(supabase, categorySlug);
  if (categoryIds === null) return fallback();

  const { data, error } = await supabase
    .from("products")
    .select("product_colors(color_name, color_hex)")
    .in("category_id", categoryIds)
    .eq("active", true);

  if (error) {
    reportOnce(
      `error:getCategoryColorOptions:${error.code ?? error.message ?? "unknown"}`,
      `Could not read category colours (${error.code ?? "no code"}: ${error.message}). Falling back to mock data.`,
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
  const rows = await readFromSupabase("getFeaturedProducts", (supabase) =>
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("featured", true)
      .order("created_at", { ascending: false }),
  );

  if (rows === null) return mockProducts().filter((product) => product.featured);
  return rows.map(toProduct).sort((a, b) => byCreatedAtDesc(a, b));
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
  const rows = await readFromSupabase(`getNewArrivals:${limit}`, (supabase) =>
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false })
      .limit(Math.max(0, limit)),
  );

  if (rows === null) return mockProducts().slice(0, Math.max(0, limit));
  return rows.map(toProduct);
}

/**
 * The views a product of this category is photographed from.
 *
 * Re-exported rather than imported from `lib/angles.ts` by the pages, so that
 * "what is a product" has exactly one entry point.
 */
export { anglesForCategory };