/**
 * Money helpers.
 *
 * Prices are whole shillings everywhere in the UI — Kenya has no practice of
 * quoting cents on leather goods, and decimal noise would make the discount
 * arithmetic look wrong. One formatter, so the card, the detail page and the
 * cart footer can never disagree.
 */

/**
 * Group a KES amount. Deliberately built from a locale formatter plus an
 * explicit "KES " prefix rather than `style: "currency"`, because the
 * currency display name varies by locale ("KSh" in en-KE) and the brief pins
 * the format as `KES 12,500`.
 */
const GROUPED = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatPrice(amount: number): string {
  return `KES ${GROUPED.format(Math.round(amount))}`;
}

/**
 * Price after a percentage discount. Exact — no rounding to the nearest 50 or
 * 100, so the figure shown always reconciles with the "-15%" badge.
 */
export function calculateDiscountedPrice(basePrice: number, discountPercent: number): number {
  if (discountPercent <= 0) return basePrice;
  return basePrice - calculateDiscountAmount(basePrice, discountPercent);
}

/** How much the discount takes off, in KES. */
export function calculateDiscountAmount(basePrice: number, discountPercent: number): number {
  if (discountPercent <= 0) return 0;
  return (basePrice * discountPercent) / 100;
}

/** True only for a real discount in the 1–99 range. Guards the badge and price swap. */
export function hasDiscount(discountPercent: number): boolean {
  return discountPercent > 0 && discountPercent < 100;
}

/**
 * The price actually charged. Every cart line stores this rather than the base
 * price, so a later price change does not silently reprice an existing cart.
 */
export function effectivePrice(basePrice: number, discountPercent: number): number {
  return hasDiscount(discountPercent)
    ? calculateDiscountedPrice(basePrice, discountPercent)
    : basePrice;
}