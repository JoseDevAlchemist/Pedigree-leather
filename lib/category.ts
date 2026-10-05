import type { Product } from "@/lib/types";

/**
 * Category → URL segment.
 *
 * `Product.category` is singular ("bag", "shoe") because it is a data column,
 * but the routes are plural ("/bags", "/shoes") because that is what a shop
 * calls a category in a URL. Interpolating the column straight into a path
 * produced `/bag/karen-briefcase`, which 404s — and it did so silently, because
 * nothing renders an href, so nothing complains until somebody clicks.
 *
 * One map, and both the path and the visible label come off it, so the link and
 * the words "All bags" can never drift apart.
 */
export const CATEGORY_SEGMENT: Record<Product["category"], string> = {
  bag: "bags",
  shoe: "shoes",
};

/** `/bags` or `/shoes`. */
export function categoryPath(category: Product["category"]): string {
  return `/${CATEGORY_SEGMENT[category]}`;
}

/** `/bags/karura-tote`. The product detail route for this product. */
export function productHref(category: Product["category"], slug: string): string {
  return `${categoryPath(category)}/${slug}`;
}

/** "bags" or "shoes" — for link text like "All bags". */
export function categoryName(category: Product["category"]): string {
  return CATEGORY_SEGMENT[category];
}