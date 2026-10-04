import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Bags",
  description:
    "Handmade leather bags, cut and stitched in Nairobi. Totes, satchels, weekenders and crossbody bags.",
};

export default async function BagsPage() {
  /* Read through the api seam so this page never learns where data comes from. */
  const products = await getProducts();
  const bags = products.filter((product) => product.category === "bag");

  /* No page heading. The grid is the page: a title above it repeats the nav
     item the shopper just tapped and pushes the bags below the fold. */
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8">
        <ProductGrid
          products={bags}
          emptyMessage="No bags are listed right now. Please check back soon."
        />
      </div>
    </main>
  );
}