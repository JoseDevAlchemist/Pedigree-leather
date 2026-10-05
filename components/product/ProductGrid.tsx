import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

type ProductGridProps = {
  products: Product[];
  /** Optional note shown when the list is empty. */
  emptyMessage?: string;
  /**
   * Show only this category. Omit to show everything passed in.
   *
   * `getProducts(category)` already asks the data layer for one category, so this
   * filter is technically redundant — and it is here anyway, because a page that
   * forgets to filter shows the wrong shop rather than failing. Two cheap guards
   * beat one that has to be remembered. `/bags` and `/shoes` pass both.
   */
  category?: Product["category"];
  /**
   * Pin the column count instead of letting the breakpoints choose. For a grid
   * that already sits inside a narrow column — the home page's previews are half a
   * wide page, and the responsive shop grid would try to put four cards in it and
   * crush all of them.
   */
  columns?: 2 | 3 | 4;
  /** Applied to the grid element itself. Used to make the grid fill a column. */
  className?: string;
};

/**
 * Column counts as classes, shared with the loading skeleton.
 *
 * Exported rather than kept private because the skeleton grid has to sit in the
 * same columns as the real one — a skeleton that lands on two columns and is
 * replaced by four is a visible reflow, which is the one thing a loading state
 * exists to prevent. Session 3 already lost an hour to a missing `grid` class
 * silently collapsing a grid to a stack; one map means that class cannot go
 * missing from only one of the two.
 */
const PINNED: Record<NonNullable<ProductGridProps["columns"]>, string> = {
  2: "grid grid-cols-2 gap-3 sm:gap-6",
  3: "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6",
  4: "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4",
};

export function gridColumnsClass(columns: NonNullable<ProductGridProps["columns"]>) {
  return PINNED[columns];
}

/**
 * The product grid.
 *
 * One renderer for every product list in the shop: `/bags`, `/shoes`, and the
 * home page's previews. It draws a list and, when told a category, applies it —
 * so the two category grids are the same code path and cannot drift apart, and
 * there is exactly one place, here, that knows how many cards fit in a row.
 *
 * Column counts follow the shop's browsing rhythm: two on a phone, two on a large
 * phone and small tablet, three on a tablet or small laptop, four from 1024px up.
 * Two columns at 375px is the whole point — a leather grid with one card per row
 * makes the shopper scroll past a lot of cream to see six products.
 *
 * The gap follows the same split: 12px between two narrow columns, 24px once there
 * is room for the cards to breathe as a collection.
 *
 * A server component — the cards carry their own client boundary for the parts
 * that need state.
 */
export function ProductGrid({
  products,
  emptyMessage,
  category,
  columns,
  className = "",
}: ProductGridProps) {
  const visible = category
    ? products.filter((product) => product.category === category)
    : products;

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-pretty text-muted">
        {emptyMessage ?? "No products here yet. Please check back soon."}
      </p>
    );
  }

  return (
    <ul className={`${gridColumnsClass(columns ?? 4)} ${className}`}>
      {visible.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}