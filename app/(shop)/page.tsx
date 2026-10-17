import { Suspense } from "react";
import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { getProducts } from "@/lib/api";

/**
 * The shop, as a catalogue.
 *
 * This page used to be a landing page: a full-height hero, a curated "Featured"
 * carousel, an automatic "New arrivals" rail and a bags/shoes split below the
 * fold. That is four things to scroll past before the first price, and the
 * shopper who already knows what they came for paid for all of it. The home page
 * is now the catalogue itself — a heading, then every product. Nothing sits
 * between the shopper and the grid.
 *
 * The hero and the two rails are gone rather than moved. `getFeaturedProducts()`
 * and `getNewArrivals()` still exist in `lib/api.ts` and still work; this page
 * simply no longer calls them. If a curated rail is wanted again it belongs
 * somewhere it can be honest about being curated, not as a gate in front of the
 * whole shop.
 */

export const metadata: Metadata = {
  /* The root layout's title template appends "| Pedigree Leather", so this
     renders as "Shop All | Pedigree Leather", like every other page's title. */
  title: "Shop All",
  description: "Browse our full collection of handcrafted leather bags and shoes.",
};

/**
 * The grid, in its own Suspense boundary.
 *
 * Scoped inside the page rather than a `loading.tsx` for the same reason `/bags`
 * does it (see the note in `app/(shop)/bags/page.tsx`): a segment-level loading
 * file wraps every route beneath the segment, and that is how a dead product URL
 * once became a permanent "Loading…" page. Keeping the boundary here also lets
 * the heading paint immediately instead of waiting on the products.
 */
async function Catalogue() {
  /* Read through the api seam so this page never learns where data comes from. */
  const products = await getProducts();

  return (
    <ProductGrid
      products={products}
      emptyMessage="No products are listed right now. Please check back soon."
    />
  );
}

export default function Home() {
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:px-8">
        <header className="max-w-3xl">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Our Catalogue
          </h1>
        </header>

        <div className="mt-8 sm:mt-10">
          <Suspense fallback={<ProductGridSkeleton count={8} />}>
            <Catalogue />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
