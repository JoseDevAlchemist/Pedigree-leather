import type { Metadata } from "next";

import { ProductGrid } from "@/components/product/ProductGrid";
import { searchProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const results = query ? await searchProducts(query) : [];

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8">
        {query ? (
          <>
            <h1 className="mb-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
              Search results for &apos;{query}&apos; ({results.length}{" "}
              {results.length === 1 ? "item" : "items"})
            </h1>

            {results.length > 0 ? (
              <ProductGrid products={results} />
            ) : (
              <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
                <p className="mx-auto max-w-md text-pretty text-muted">
                  No results found for &apos;{query}&apos;. Try searching for
                  &apos;brown&apos; or &apos;bag&apos;.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              Search
            </h1>
            <p className="mt-3 text-muted">Type something to search.</p>
          </div>
        )}
      </div>
    </main>
  );
}
