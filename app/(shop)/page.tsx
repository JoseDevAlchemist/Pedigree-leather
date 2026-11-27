import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { ProductGrid, visibleCatalogueProducts } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { getHomepageProducts } from "@/lib/api";
import { BRAND_STATEMENT, storefrontBrandCopy } from "@/lib/brand";
import { CATEGORY_SEGMENT } from "@/lib/category";
import { effectivePrice } from "@/lib/format";
import { NAV_ITEMS } from "@/lib/navigation";
import { getStorefrontPreferences } from "@/lib/settings-api";
import type { Product } from "@/lib/types";

const sectionsByCategory = (["bag", "shoe", "belt"] as const).map((category) => {
  const href = `/category/${CATEGORY_SEGMENT[category]}`;
  return { category, href, label: NAV_ITEMS.find((item) => item.href === href)?.label ?? CATEGORY_SEGMENT[category] };
});
const previewSize = 4;
const featuredSize = 8;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontPreferences();
  const title = storefrontBrandCopy(settings.seo_title);
  return {
    title: title ? { absolute: title } : "Shop All",
    description: storefrontBrandCopy(settings.seo_description) || BRAND_STATEMENT,
  };
}

async function Catalogue() {
  const [settings, ...groups] = await Promise.all([
    getStorefrontPreferences(),
    ...sectionsByCategory.map(({ category }) => getHomepageProducts(category)),
  ]);

  const direction = settings.homepage_sort === "price_asc" ? 1
    : settings.homepage_sort === "price_desc" ? -1 : 0;
  const sections = sectionsByCategory.map((item, index) => ({
    ...item,
    products: visibleCatalogueProducts(groups[index], settings.hide_unavailable).toSorted((a, b) => {
      const featured = settings.feature_first ? Number(b.featured) - Number(a.featured) : 0;
      return featured || direction * (
        effectivePrice(a.basePrice, a.discountPercent) - effectivePrice(b.basePrice, b.discountPercent)
      );
    }),
  }));

  const featured = new Map<string, Product>();
  const candidates = sections.map(({ products }) =>
    products.toSorted((a, b) => Number(b.featured) - Number(a.featured)).slice(0, featuredSize),
  );
  for (let rank = 0; rank < featuredSize && featured.size < featuredSize; rank++) {
    for (const group of candidates) {
      const product = group[rank];
      if (product) featured.set(product.id, product);
      if (featured.size === featuredSize) break;
    }
  }

  return (
    <div className="space-y-10 sm:space-y-14">
      <section aria-labelledby="featured-products">
        <h2 id="featured-products" className="mb-4 font-serif text-2xl font-semibold sm:text-3xl">Featured Products</h2>
        <ProductGrid products={[...featured.values()]} />
      </section>
      {sections.filter(({ products }) => products.length > 0).map(({ href, label, products }) => (
        <section key={href} aria-label={label}>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">{label}</h2>
            <Link href={href} className="text-sm font-semibold text-primary underline underline-offset-4">
              View all {label.toLowerCase()}
            </Link>
          </div>
          <ProductGrid products={products.slice(0, previewSize)} eagerFirstImage={false} />
        </section>
      ))}
    </div>
  );
}

export default async function Home() {
  const settings = await getStorefrontPreferences();
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:px-8">
        <header className="max-w-3xl">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {storefrontBrandCopy(settings.hero_title) || "Our Catalogue"}
          </h1>
        </header>

        <div className="mt-6 sm:mt-8">
          <Suspense fallback={<ProductGridSkeleton count={8} />}>
            <Catalogue />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
