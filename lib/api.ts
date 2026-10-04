import { MOCK_PRODUCTS } from "@/lib/mock-data";
import type { Product } from "@/lib/types";

/**
 * The one place the shop reads products from.
 *
 * Components import from here and never from `lib/mock-data.ts`. Both functions
 * are `async` even though they currently resolve from memory, so callers are
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
 * All products, newest first. The grid filters by `category` itself, which
 * keeps shoes a one-line change when they launch.
 */
export async function getProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS;
}

/** A single product by slug, or `null` when the slug does not exist. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return MOCK_PRODUCTS.find((product) => product.slug === slug) ?? null;
}

/**
 * Every known slug, for `generateStaticParams`. Without this the dynamic route
 * can only be resolved at request time.
 */
export async function getProductSlugs(): Promise<string[]> {
  return MOCK_PRODUCTS.map((product) => product.slug);
}