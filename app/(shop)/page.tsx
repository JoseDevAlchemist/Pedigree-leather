import { Suspense } from "react";
import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { getProducts } from "@/lib/api";
import { effectivePrice } from "@/lib/format";
import { getStorefrontPreferences } from "@/lib/settings-api";

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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontPreferences();
  return {
    title: settings.seo_title ? { absolute: settings.seo_title } : "Shop All",
    description: settings.seo_description || "Browse our full collection of handcrafted leather bags and shoes.",
  };
}

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
  const [products, settings] = await Promise.all([getProducts(), getStorefrontPreferences()]);
  const sort = settings.homepage_sort;
  const direction = sort === "price_asc" ? 1 : sort === "price_desc" ? -1 : 0;
  const visible = direction || settings.feature_first
    ? [...products].sort((a, b) => {
      const featured = settings.feature_first ? Number(b.featured) - Number(a.featured) : 0;
      return featured || direction * (
        effectivePrice(a.basePrice, a.discountPercent) - effectivePrice(b.basePrice, b.discountPercent)
      );
    })
    : products;

  return (
    <ProductGrid
      products={visible}
      emptyMessage="No products are listed right now. Please check back soon."
    />
  );
}

export default async function Home() {
  const settings = await getStorefrontPreferences();
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:px-8">
        <header className="max-w-3xl">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {settings.hero_title || "Our Catalogue"}
          </h1>
          {settings.hero_description && <p className="mt-3 text-muted">{settings.hero_description}</p>}
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
