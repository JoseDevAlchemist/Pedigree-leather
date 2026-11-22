import { ArrowRight, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductFilters } from "@/components/admin/ProductFilters";
import { ProductTable } from "@/components/admin/ProductTable";
import { listProducts } from "@/lib/admin-api";
import { requireRole } from "@/lib/roles";
import { getInventoryPreferences } from "@/lib/admin-inventory-preferences";
import { inventoryDefaults } from "@/lib/settings-schema";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireRole("owner");

  const params = await searchParams;
  const rawCategory = params.category;
  const category = rawCategory === "bag" || rawCategory === "shoe" || rawCategory === "belt" ? rawCategory : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;

  /* The visible rows, filtered. */
  const [products, everything, inventory] = await Promise.all([
    listProducts({ category, search }),
    category || search?.trim() ? listProducts() : Promise.resolve(null),
    getInventoryPreferences(),
  ]);

  const catalogue = everything ?? products;
  const counts = {
    all: catalogue.length,
    bag: catalogue.filter((product) => product.category === "bag").length,
    shoe: catalogue.filter((product) => product.category === "shoe").length,
    belt: catalogue.filter((product) => product.category === "belt").length,
  };

  const isFiltered = Boolean(category || search);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Products
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isFiltered
              ? `${products.length} of ${counts.all} shown`
              : `${counts.all} in the catalogue`}
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Add product
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {/* `useSearchParams` needs a Suspense boundary above it, or Next refuses to
          render this route statically. */}
      <div className="mt-6">
        <Suspense fallback={<div className="h-10" />}>
          <ProductFilters counts={counts} />
        </Suspense>
      </div>

      <div className="mt-4">
        {products.length === 0 ? (
          <EmptyState isFiltered={isFiltered} />
        ) : (
          <ProductTable products={products} inventory={inventory ?? inventoryDefaults} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
      <Package size={24} strokeWidth={1.75} className="mx-auto text-muted" aria-hidden="true" />

      <p className="mt-3 text-sm text-foreground">
        {isFiltered ? "Nothing matches that." : "The catalogue is empty."}
      </p>

      <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted">
        {isFiltered
          ? "A different word, or the All chip, will show everything again."
          : "Add the first product and it will appear in the shop as soon as it is saved."}
      </p>

      {isFiltered ? (
        <Link
          href="/admin/products"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Clear filters
          <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : (
        <Link
          href="/admin/products/new"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add product
          <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}