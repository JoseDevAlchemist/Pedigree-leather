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

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="max-w-xl">
          <h1 className="text-pretty font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Our Bags
          </h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted">
            Every bag is cut from a single hide and stitched by hand in our workshop
            in Nairobi. Choose a colour, then walk around it to see it from every side.
          </p>
        </header>

        <div className="mt-8 sm:mt-10">
          <ProductGrid
            products={bags}
            emptyMessage="No bags are listed right now. Please check back soon."
          />
        </div>
      </div>
    </main>
  );
}