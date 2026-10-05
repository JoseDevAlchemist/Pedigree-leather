import { MOCK_PRODUCTS } from "@/lib/mock-data";
import type { Product } from "@/lib/types";

/**
 * The one place the shop reads products from.
 *
 * Components import from here and never from `lib/mock-data.ts`. Every function
 * is `async` even though they currently resolve from memory, so callers are
 * already written against a promise — swapping in the admin API changes the
 * bodies below and nothing else.
 *
 * ---------------------------------------------------------------------------
 * FUTURE: real API
 * ---------------------------------------------------------------------------
 * Replace the mock bodies with fetches. The signatures stay identical.
 *
 *   const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.pedigreeleather.co";
 *
 *   export async function getProducts(): Promise<Product[]> {
 *     const res = await fetch(`${API}/products`, {
 *       next: { revalidate: 300, tags: ["products"] },
 *     });
 *     if (!res.ok) throw new Error(`getProducts failed: ${res.status}`);
 *     return (await res.json()) as Product[];
 *   }
 *
 *   export async function getProductBySlug(slug: string): Promise<Product | null> {
 *     const res = await fetch(`${API}/products/${encodeURIComponent(slug)}`, {
 *       next: { revalidate: 300, tags: [`product:${slug}`] },
 *     });
 *     if (res.status === 404) return null;   // the detail page calls notFound()
 *     if (!res.ok) throw new Error(`getProductBySlug failed: ${res.status}`);
 *     return (await res.json()) as Product;
 *   }
 *
 * The admin panel will call `revalidateTag("products")` after any write, which
 * is why every read here is tagged.
 *
 * Note that a fetch returning `null` is the contract for "not found" — the
 * detail page turns it into a 404, so callers must not return a stub object.
 */

/**
 * Newest first. Compares as dates, not as strings, so a product saved with a
 * `+03:00` offset sorts correctly against one saved in `Z`.
 */
function byCreatedAtDesc(a: Product, b: Product): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

/**
 * All products, newest first. The grid filters by `category` itself, which
 * keeps shoes a one-line change when they launch.
 *
 * The optional `category` is the query the real API will want — asking the
 * database for one category is an indexed read, where fetching everything and
 * filtering here is not. It is applied as well as `ProductGrid`'s own filter, and
 * the two agree, so nothing is filtered twice.
 */
export async function getProducts(category?: Product["category"]): Promise<Product[]> {
  const newestFirst = [...MOCK_PRODUCTS].sort((a, b) => byCreatedAtDesc(a, b));
  return category ? newestFirst.filter((p) => p.category === category) : newestFirst;
}

/**
 * A single product by slug, or `null` when the slug does not exist.
 *
 * The optional `category` is not a filter for convenience — it is what keeps
 * `/bags/karura-tote` and `/shoes/karura-tote` from both existing. Slugs are
 * unique across the whole catalogue, so without it a shoe slug resolves on the
 * bags route and vice versa: a page that renders, is crawlable, and shows the
 * wrong category. Each route passes the category it is responsible for.
 */
export async function getProductBySlug(
  slug: string,
  category?: Product["category"],
): Promise<Product | null> {
  const product = MOCK_PRODUCTS.find((entry) => entry.slug === slug);
  if (!product) return null;
  if (category && product.category !== category) return null;
  return product;
}

/**
 * Every known slug, for `generateStaticParams`. Without this the dynamic route
 * can only be resolved at request time.
 *
 * The optional `category` keeps each category route prerendering only its own
 * products, matching what `getProductBySlug` will accept.
 */
export async function getProductSlugs(category?: Product["category"]): Promise<string[]> {
  const products = category
    ? MOCK_PRODUCTS.filter((product) => product.category === category)
    : MOCK_PRODUCTS;
  return products.map((product) => product.slug);
}

/**
 * The home page's "Featured" rail.
 *
 * Manual curation, not a ranking: a product is in here because somebody set
 * `featured` on it in the admin. The home page never reorders or re-picks these
 * slots, so a bag stays at the front of the rail for as long as it is
 * featured.
 *
 * ---------------------------------------------------------------------------
 * FUTURE: real API
 * ---------------------------------------------------------------------------
 *   const res = await fetch(`${API}/products?featured=true&order=featured`, {
 *     next: { revalidate: 300, tags: ["products", "featured"] },
 *   });
 *
 * The `order` param is the one thing worth adding on the server: once more than
 * a handful of products are featured the admin needs a rank column, otherwise
 * the rail has no stable order.
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS.filter((product) => product.featured);
}

/**
 * The home page's "New Arrivals" grid, and the basis of any future
 * "recently added" list.
 *
 * Automatic by construction — sorted by `createdAt` descending and cut to
 * `limit`. There is no cron and no daily shuffle: a product reaches this list
 * the moment it is created, and falls off it only when `limit` newer products
 * push it out. Freshness should come from new stock, not from rotation.
 *
 * `limit` is clamped to what exists rather than padded, so a small catalogue
 * renders a short grid instead of an empty-state box.
 *
 * ---------------------------------------------------------------------------
 * FUTURE: real API
 * ---------------------------------------------------------------------------
 *   const res = await fetch(`${API}/products?order=created_at.desc&limit=${limit}`, {
 *     next: { revalidate: 300, tags: ["products"] },
 *   });
 *
 * The sort must happen server-side eventually — asking the database for 8 of
 * the newest is an indexed query, whereas fetching every product and slicing in
 * JS does not scale past a few hundred rows.
 */
export async function getNewArrivals(limit: number): Promise<Product[]> {
  const newestFirst = [...MOCK_PRODUCTS].sort((a, b) => byCreatedAtDesc(a, b));
  return newestFirst.slice(0, Math.max(0, limit));
}