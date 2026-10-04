import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

type ProductGridProps = {
  products: Product[];
  /** Optional note shown when the list is empty. */
  emptyMessage?: string;
};

/**
 * The product grid.
 *
 * Column counts follow the brief: one column on a phone, two on a tablet, three
 * on a small laptop, four on a wide one. The jump from three to four happens at
 * 1280px, where four cards still leave a readable card width.
 *
 * A server component — the cards carry their own client boundary for the parts
 * that need state.
 */
export function ProductGrid({ products, emptyMessage }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-pretty text-muted">
        {emptyMessage ?? "No products here yet. Please check back soon."}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}