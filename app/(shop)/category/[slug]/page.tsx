import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { FilterBar } from "@/components/shop/FilterBar";
import { getCategories, getCategoryBySlug } from "@/lib/categories-api";
import { getCategoryColorOptions, getProductsByCategory } from "@/lib/api";
import {
  countActiveFilters,
  parseProductFilters,
  resolveColorNames,
  type ProductFilters,
} from "@/lib/product-filters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category" };

  return {
    title: category.name,
    description: `Shop ${category.name} at Pedigree.`,
    robots: { index: true, follow: true },
  };
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const filters = parseProductFilters(rawSearchParams);

  const [category, categories, colorOptions] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
    getCategoryColorOptions(slug),
  ]);
  if (!category) {
    notFound();
  }

  const children = categories.filter((entry) => entry.parentId === category.id);
  const activeFilterCount = countActiveFilters(filters);
  const dataFilters: ProductFilters = {
    ...filters,
    colors: resolveColorNames(filters.colors, colorOptions),
  };

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8">
        <h1 className="mb-4 font-serif text-3xl font-semibold tracking-tight text-foreground">
          {category.name}
        </h1>

        {children.length > 0 ? (
          <nav aria-label={`${category.name} subcategories`} className="mb-6">
            <ul className="flex flex-wrap gap-2">
              {children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/category/${child.slug}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <FilterBar availableColors={colorOptions} filters={filters} />

          <div className="min-w-0">
            <Suspense fallback={<ProductGridSkeleton count={8} />}>
              <CategoryGrid
                slug={slug}
                categoryName={category.name}
                filters={dataFilters}
                filtered={activeFilterCount > 0}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}

async function CategoryGrid({
  slug,
  categoryName,
  filters,
  filtered,
}: {
  slug: string;
  categoryName: string;
  filters: ProductFilters;
  filtered: boolean;
}) {
  const products = await getProductsByCategory(slug, filters);
  const name = categoryName.toLowerCase();

  return (
    <ProductGrid
      products={products}
      emptyMessage={
        filtered
          ? `No ${name} match these filters. Try clearing a colour or price range.`
          : `No ${name} are listed right now. Please check back soon.`
      }
    />
  );
}
