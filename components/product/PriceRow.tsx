"use client";

import { hasDiscount, formatPrice, calculateDiscountedPrice } from "@/lib/format";

type PriceRowProps = {
  basePrice: number;
  discountPercent: number;
  /** `card` for the grid, `detail` for the product page. */
  size?: "card" | "detail";
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
  className = "",
}: PriceRowProps) {
  const discounted = hasDiscount(discountPercent);
  const price = discounted ? calculateDiscountedPrice(basePrice, discountPercent) : basePrice;

  const priceSize = size === "detail" ? "text-3xl md:text-4xl" : "text-base";
  const baseSize = size === "detail" ? "text-lg" : "text-sm";

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 ${className}`}
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