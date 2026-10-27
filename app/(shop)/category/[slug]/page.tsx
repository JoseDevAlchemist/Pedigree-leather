import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton";
import { getCategories, getCategoryBySlug } from "@/lib/categories-api";
import { getProductsByCategory } from "@/lib/api";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);
  if (!category) {
    notFound();
  }

  const children = categories.filter((entry) => entry.parentId === category.id);

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

        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <CategoryGrid slug={slug} categoryName={category.name} />
        </Suspense>
      </div>
    </main>
  );
}

async function CategoryGrid({
  slug,
  categoryName,
}: {
  slug: string;
  categoryName: string;
}) {
  const products = await getProductsByCategory(slug);

  return (
    <ProductGrid
      products={products}
      emptyMessage={`No ${categoryName.toLowerCase()} are listed right now. Please check back soon.`}
    />
  );
}
