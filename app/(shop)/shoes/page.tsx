import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Shoes",
  description:
    "Handmade leather shoes, welted and stitched in Nairobi. Derbies, boots and loafers, built to be resoled rather than replaced.",
};

/**
 * The shoes grid.
 *
 * Deliberately identical to `/bags` — same container, same padding, same
 * breakpoints, and no page heading. The two categories are the same kind of
 * thing, so they should look the same, and the only reason a shopper is on this
 * page rather than that one is the nav item they just tapped. A heading would
 * only restate it and push the shoes below the fold.
 */
export default async function ShoesPage() {
  /* Read through the api seam so this page never learns where data comes from. */
  const shoes = await getProducts("shoe");

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8">
        <ProductGrid
          products={shoes}
          category="shoe"
          emptyMessage="No shoes are listed right now. Our bags are ready today."
        />
      </div>
    </main>
  );
}