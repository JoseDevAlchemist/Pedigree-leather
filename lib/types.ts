/**
 * The shop's domain model.
 *
 * Every shape in this file is meant to survive the move from mock data to the
 * Supabase-backed admin API: the admin will write exactly these columns, so
 * nothing here is a view concern. When real photos arrive they land in
 * `ColorVariant.images` and every consumer already handles the `null` case.
 */

/**
 * One view of a product.
 *
 * The union is all eight views the workshop might photograph, not the views any
 * single product has. Which subset a product actually has is `Product.angles`,
 * and the admin chooses that subset freely per product. Nothing outside
 * `Product.angles` should ever be indexed for a given product.
 */
export type Angle =
  | "front"
  | "side-left"
  | "side-right"
  | "side"
  | "top"
  | "bottom"
  | "back"
  | "laces";

/**
 * One colourway of a product. `hex` drives both the swatch fill and the
 * placeholder block that stands in for photography.
 *
 * `images` is built for the product's chosen angle list. An unphotographed view
 * is `null`, so the placeholder knows to draw rather than the app crashing on a
 * missing key. Views outside `Product.angles` are not read for this product.
 */
export interface ColorVariant {
  id: string;
  name: string;
  /** Swatch + placeholder fill, e.g. "#8B4513". */
  hex: string;
  /**
   * A slot for every angle in `Product.angles`, plus `null` for angles the
   * product uses but has not photographed. Keeping the record total over that
   * list is what makes `images[angle] ?? null` safe.
   */
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
  /** Optional price in USD before any discount. When null/undefined, only KES is shown. */
  basePriceUsd?: number | null;
  /** 0 for no discount. Otherwise 1–99. Applied to `basePrice` and `basePriceUsd` proportionally. */
  discountPercent: number;
  /** Units across all colours. 0 means the product is sold out. */
  stockQuantity: number;
  colors: ColorVariant[];
  category: "bag" | "shoe";
  /** The admin-managed category this product belongs to, if any. */
  categoryId?: string | null;
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
  /**
   * This product's views, in the admin's chosen roll order. A new bag starts as
   * front → side-left → side-right → top → back and a new shoe as front → laces
   * → side → back → bottom, but the admin can remove any view and add any unused
   * one, so a product may have as few as one and as many as eight.
   *
   * Per product rather than one global list, because the roll, the dots, the
   * arrows and the "1 / N" counter all address positions in *this* array. A
   * product with three photographs must not inherit five dots.
   *
   * Always non-empty: it is derived from the stored image rows, falling back to
   * the category's default placeholders when the product has no photography.
   */
  angles: Angle[];
}

/**
 * An admin-managed product category. `parentId` is null for top-level
 * categories (Bags, Shoes, Belts); children (Handbags, Laptop Bags, …) point
 * at their parent. `displayOrder` sorts siblings; `isActive` hides a category
 * from the shop without deleting it.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
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
  /** Base price before discount (for discount display at checkout). */
  basePrice: number;
  quantity: number;
  image: string | null;
}