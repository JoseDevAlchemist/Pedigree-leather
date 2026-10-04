import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

type ProductGridProps = {
  products: Product[];
  /** Optional note shown when the list is empty. */
  emptyMessage?: string;
  /**
   * Pin the column count instead of letting the breakpoints choose. For a grid
   * that already sits inside a narrow column — the home page's bags preview is
   * half a wide page, and the responsive shop grid would try to put four cards
   * in it and crush all of them.
   */
  columns?: 2 | 3 | 4;
};

const PINNED: Record<NonNullable<ProductGridProps["columns"]>, string> = {
  2: "grid grid-cols-2 gap-3 sm:gap-6",
  3: "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6",
  4: "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4",
};

/**
 * The product grid.
 *
 * Column counts follow the shop's browsing rhythm: two on a phone, two on a
 * large phone and small tablet, three on a tablet or small laptop, four from
 * 1024px up. Two columns at 375px is the whole point — a leather grid with one
 * card per row makes the shopper scroll past a lot of cream to see six bags.
 *
 * The gap follows the same split: 12px between two narrow columns, 24px once
 * there is room for the cards to breathe as a collection.
 *
 * A server component — the cards carry their own client boundary for the parts
 * that need state.
 */
export function ProductGrid({ products, emptyMessage, columns }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-pretty text-muted">
        {emptyMessage ?? "No products here yet. Please check back soon."}
      </p>
    );
  }

  return (
    <ul className={columns ? PINNED[columns] : PINNED[4]}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}