import { anglesForCategory, toProduct } from "@/lib/mappers";
import type { ProductWithRelations } from "@/lib/mappers";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
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
 * These reads are static-page reads, so they happen at build time and are baked
 * into the prerendered HTML — the route list should show `○` for `/`, `/bags`,
 * `/shoes` and the product pages. A product added in the admin gets its page on
 * request (`dynamicParams` defaults to true) but does not appear in an already built
 * grid until the next build. That is the right trade for a shop whose catalogue changes
 * a few times a month, and the wrong one the moment it changes hourly — the fix is a
 * `revalidateTag` call, and `lib/actions/products.ts` already calls `revalidatePath`
 * for the three shop routes after every write, so a `next build` is not the only way
 * they update.
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