"use client";

import { hasDiscount, formatPrice, calculateDiscountedPrice } from "@/lib/format";

type PriceRowProps = {
  basePrice: number;
  discountPercent: number;
  /**
   * `card` for the grid, `detail` for the product page. The card size is
   * responsive rather than fixed: the grid goes two-up under `sm`, where a
   * 16px price beats a 18px one, so the row does not wrap mid-number.
   */
  size?: "card" | "detail";
  /**
   * Put the struck-through base price on its own line. Cards want this: the
   * price sits in a row with up to four swatches, and a 254px card cannot hold
   * "KES 11,900 KES 14,000" plus 128px of swatches. Without it the formatter's
   * own `flex-wrap` breaks the pair mid-figure — "KES" / "14,850" / "KES
   * 16,500". The detail page has room, so it reads them on one line.
   */
  stacked?: boolean;
  /** Sold-out products still show their price — they just cannot be bought. */
  muted?: boolean;
  className?: string;
};

/**
 * Price, with the discount treatment.
 *
 * One component so the card and the detail page can never drift apart: a
 * discounted product shows the base price struck through, the real price in the
 * accent, and a percentage badge. Nothing discounted shows one number and stops.
 *
 * The badge sits outside this component — it is positioned over the image, not
 * in the price row — so `PriceRow` stays layout-agnostic.
 */
export function PriceRow({
  basePrice,
  discountPercent,
  size = "card",
  muted = false,
  stacked = false,
  className = "",
}: PriceRowProps) {
  const discounted = hasDiscount(discountPercent);
  const price = discounted ? calculateDiscountedPrice(basePrice, discountPercent) : basePrice;

  const priceSize = size === "detail" ? "text-3xl md:text-4xl" : "text-sm sm:text-base";
  const baseSize = size === "detail" ? "text-lg" : "text-xs sm:text-sm";

  const layout = stacked
    ? "flex-col items-start gap-y-0"
    : "flex-wrap items-baseline gap-x-2.5 gap-y-0.5";

  return (
    <div
      className={`flex ${layout} ${className}`}
      /* Read out as one phrase: "12500 shillings, reduced from 14000". */
      aria-label={
        discounted
          ? `${formatPrice(price)}, reduced from ${formatPrice(basePrice)}`
          : formatPrice(basePrice)
      }
    >
      <span
        className={`${priceSize} font-semibold tabular-nums ${
          discounted ? "text-accent" : muted ? "text-muted" : "text-foreground"
        }`}
      >
        {formatPrice(price)}
      </span>

      {discounted ? (
        <span className={`${baseSize} text-muted line-through tabular-nums`}>
          {formatPrice(basePrice)}
        </span>
      ) : null}
    </div>
  );
}

type DiscountBadgeProps = {
  discountPercent: number;
  className?: string;
};

/** The "-15%" chip. Positioned by the caller, over the product image. */
export function DiscountBadge({ discountPercent, className = "" }: DiscountBadgeProps) {
  if (!hasDiscount(discountPercent)) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-semibold tabular-nums text-accent-ink shadow-bar ${className}`}
    >
      −{Math.round(discountPercent)}%
    </span>
  );
}