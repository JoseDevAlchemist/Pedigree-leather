import { gridColumnsClass } from "@/components/product/ProductGrid";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The loading twin of `ProductCard`.
 *
 * Eight of these stand in for the grid while the products are in flight. The
 * layout has to be the card's layout — square image, dots, name, price, swatches
 * — for the loading state to do its actual job, which is to hold the page's shape
 * so nothing moves when the real grid arrives. A row of generic grey bars would
 * be less code and worth less: the shopper would see the grid jump up by the
 * height of a description they never saw.
 *
 * Deliberately has no `"use client"` and no state. It is markup, and shipping it
 * to the browser as an interactive component would add a hydration boundary per
 * card for something that never changes after mount.
 *
 * The two densities match `ProductCard`'s: the description line is present but
 * sized for `sm` and up, where the real card shows it.
 */

type ProductCardSkeletonProps = {
  className?: string;
};

export function ProductCardSkeleton({ className = "" }: ProductCardSkeletonProps) {
  return (
    <div className={`flex flex-col rounded-2xl bg-card shadow-card ${className}`}>
      {/* Square image well. Same `aspect-square` as the card's, which is what
          actually fixes the card's height. */}
      <div className="aspect-square rounded-2xl bg-border/40" />

      <div className="flex flex-1 flex-col gap-2 px-3 pt-3 pb-4 sm:gap-2.5 sm:px-4 sm:pt-3.5 sm:pb-5">
        {/* The five angle dots, as five small blocks. */}
        <div aria-hidden="true" className="flex items-center gap-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="size-1.5 rounded-full" />
          ))}
        </div>

        {/* Name. Varies in width per card so the block does not read as a table
            of identical rows — real names differ, so the loading state should. */}
        <Skeleton className="h-4 w-4/5 sm:h-5" />

        {/* Two description lines, hidden on mobile exactly as the real one is. */}
        <div className="hidden gap-1.5 sm:flex sm:flex-col">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>

        {/* Price on the left, four swatches on the right — the card's own
            `justify-between` row, so the swap is invisible. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-1.5">
          <Skeleton className="h-4 w-20 sm:w-24" />
          <div aria-hidden="true" className="flex items-center gap-1.5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="size-4 rounded-full sm:size-5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A grid of skeleton cards.
 *
 * `count` defaults to 8 — two rows at the shop's widest four-column layout.
 * Sized to the grid rather than to the catalogue on purpose: the count cannot be
 * known until the products arrive, and a skeleton grid that reflows when it does
 * is worse than one that was slightly the wrong size.
 */
export function ProductGridSkeleton({
  count = 8,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    /* `role="status"` on the grid rather than a separate `<p>`: it announces the
       loading state once, and every block inside is `aria-hidden` anyway, so the
       grid would otherwise be completely silent to a screen reader. */
    <ul
      role="status"
      aria-label="Loading products"
      className={`${gridColumnsClass(4)} ${className}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <ProductCardSkeleton className="h-full" />
        </li>
      ))}
    </ul>
  );
}