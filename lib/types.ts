/**
 * The shop's domain model.
 *
 * Every shape in this file is meant to survive the move from mock data to the
 * Supabase-backed admin API: the admin will write exactly these columns, so
 * nothing here is a view concern. When real photos arrive they land in
 * `ColorVariant.images` and every consumer already handles the `null` case.
 */

/** The five angles a bag is photographed from, in the order they are shown. */
export type Angle = "front" | "side-left" | "side-right" | "top" | "back";

/**
 * One colourway of a product. `hex` drives both the swatch fill and the
 * placeholder block that stands in for photography.
 *
 * `images` is a full record rather than a partial one so that "this angle was
 * never photographed" (`null`) is distinguishable from "we forgot to load it".
 */
export interface ColorVariant {
  id: string;
  name: string;
  /** Swatch + placeholder fill, e.g. "#8B4513". */
  hex: string;
  images: Record<Angle, string | null>;
}

export interface Product {
  id: string;
  name: string;
  /** URL segment: `/bags/${slug}`. Stable — never reuse an id as a slug. */
  slug: string;
  /** One or two sentences of plain copy. Shown clamped on the card, in full on the detail page. */
  description: string;
  /** Price in KES before any discount. */
  basePrice: number;
  /** 0 for no discount. Otherwise 1–99. Applied to `basePrice`. */
  discountPercent: number;
  /** Units across all colours. 0 means the product is sold out. */
  stockQuantity: number;
  colors: ColorVariant[];
  category: "bag" | "shoe";
  /**
   * Curated by hand in the admin. `true` puts the product in the home page's
   * "Featured" rail — a merchandising decision, so it is never derived.
   */
  featured: boolean;
  /**
   * ISO 8601 timestamp of when the product was listed. The only ordering the
   * "New Arrivals" grid trusts: freshness comes from adding stock, not from a
   * rotating shuffle.
   */
  createdAt: string;
}

/**
 * A cart line. Identity is `productId` + `colorId`, so the same bag in two
 * colours is two separate lines.
 *
 * Deliberately denormalised: the cart must stay readable after a reload, and
 * after we one day stop listing a product. `image` is the front angle of the
 * chosen colour, or `null` while photography is still pending.
 */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  /** Price in KES for one unit, discount already applied. */
  unitPrice: number;
  quantity: number;
  image: string | null;
}