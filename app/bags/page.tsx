import { Suspense } from "react";
import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Bags",
  description:
    "Handmade leather bags, cut and stitched in Nairobi. Totes, satchels, weekenders and crossbody bags.",
};

/**
 * The grid, with the skeletons as its fallback.
 *
 * This is a separate component from `BagsPage` on purpose, and the reason is the
 * single most expensive bug in this file's history.
 *
 * `loading.tsx` at the `/bags` segment level looks like the obvious way to do
 * this, and it is wrong. A segment's loading file wraps **every route beneath
 * it**, `/bags/[slug]` included. `notFound()` thrown inside the slug page is
 * then caught by that Suspense boundary, which renders the fallback shell and
 * returns **HTTP 200 with the page permanently stuck on "Loading bags…"**.
 * A mistyped or dead product URL became a 200: uncrawlable-as-an-error,
 * indexable, and blank. `/shoes` had no `loading.tsx`, which is the only reason
 * its 404 behaved correctly — the two routes had identical logic and opposite
 * behaviour, and the difference was a file that was supposed to be a loading
 * state.
 *
 * Putting the boundary *inside* the page scopes it to this grid. `/bags/[slug]`
 * is a sibling segment under `/bags`, not a child of this component, so it never
 * sees this Suspense boundary and `notFound()` reaches the router.
 *
 * Note the honest consequence: because the mock api resolves synchronously and
 * the route is prerendered, the fallback is rarely seen. That is the correct
 * outcome, not a broken loading state — once a real API is behind `getProducts`,
 * this boundary is already in place and the skeletons appear without any further
 * change here.
 */
async function BagsGrid() {
  /* Read through the api seam so this page never learns where data comes from. */
  const bags = await getProducts("bag");

  return (
    <ProductGrid
      products={bags}
      category="bag"
      emptyMessage="No bags are listed right now. Please check back soon."
    />
  );
}

export default function BagsPage() {
  /* No page heading. The grid is the page: a title above it repeats the nav
     item the shopper just tapped and pushes the bags below the fold. */
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8">
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <BagsGrid />
        </Suspense>
      </div>
    </main>
  );
}