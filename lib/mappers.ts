import { ALL_ANGLES, angleOrder, categoryAngles } from "@/lib/angles";
import type { Tables } from "@/lib/supabase/types";
import type { Angle, ColorVariant, Product } from "@/lib/types";

/**
 * Row → domain mapping.
 *
 * The database speaks snake_case and the shop speaks camelCase. Every value that
 * crosses that boundary passes through this file, in both directions, so there is
 * exactly one place where a column name appears and exactly one place to look when
 * a field is mysteriously empty.
 *
 * It lives here rather than in `lib/api.ts` and `lib/admin-api.ts` because both of
 * those need it: one reads public rows through RLS, the other reads admin rows
 * through the service role, and they must produce the *same* `Product` or the same
 * product would look different in the shop and in the admin.
 */

type ProductRow = Tables<"products">;
type ColorRow = Tables<"product_colors">;
type ImageRow = Tables<"product_images">;

/** The nested shape one PostgREST select produces, with the joins typed. */
export type ProductWithRelations = ProductRow & {
  product_colors: (ColorRow & { product_images: ImageRow[] })[];
};

/**
 * Whether an angle string is one we know.
 *
 * The column is a `text` with a CHECK rather than a Postgres enum (see
 * 001_initial.sql for why), so TypeScript cannot narrow it for us and a bad value
 * is a runtime possibility rather than a type error. An unknown angle is dropped
 * rather than thrown on: one unrecognised row must not take down a whole grid
 * render, and the alternative — refusing to show the product — is worse than
 * showing it with one view missing.
 */
function isAngle(value: string): value is Angle {
  return (
    value === "front" ||
    value === "side-left" ||
    value === "side-right" ||
    value === "side" ||
    value === "top" ||
    value === "bottom" ||
    value === "back" ||
    value === "laces"
  );
}

/**
 * Does this category name mean anything?
 *
 * `category` is `text` with a CHECK, so it arrives as `string`. Narrowing here
 * rather than casting at each use site means a value the CHECK somehow let
 * through degrades to a sensible category instead of producing a `/undefined/`
 * URL or five angles that do not exist.
 */
function isCategory(value: string): value is Product["category"] {
  return value === "bag" || value === "shoe";
}

/**
 * Build one colourway from its row and its image rows.
 *
 * The record is built for the product's own roll order: every angle in that list
 * gets either the stored URL or `null`. That is what lets every consumer write
 * `images[angle] ?? null` without checking whether the key exists — that
 * expression appears on the card, the detail page and the cart line, and adding a
 * guard to each of them would be three chances to forget one.
 */
function toColorVariant(row: ColorRow, images: ImageRow[], productAngles: Angle[]): ColorVariant {
  const byAngle = new Map<string, string>();
  for (const image of images) {
    /* A null image_url is a slot that has not been photographed. It is not an
       error and it is not "delete the slot" — it is the state the colour-block
       placeholder is designed to draw, so it is simply absent from the map. */
    if (!image.image_url || !isAngle(image.angle)) continue;
    byAngle.set(image.angle, image.image_url);
  }

  const record = {} as Record<Angle, string | null>;
  for (const angle of productAngles) {
    record[angle] = byAngle.get(angle) ?? null;
  }

  return {
    id: row.id,
    name: row.color_name,
    hex: row.color_hex,
    images: record,
  };
}

/**
 * The views this product actually has, in the order the admin arranged them.
 *
 * A product is no longer limited to the category's five default views. The
 * admin can save three image slots, or eight, so the shop must derive the roll
 * from the stored image rows rather than from the category alone. Rows written
 * by the current form carry `sort_order`; legacy rows all carry zero and fall
 * back to the category's preferred order, then the remaining known angles.
 *
 * If the product has no photography at all, it keeps the category's five
 * placeholder views — that is what makes an unphotographed product browsable.
 */
function productAngles(
  colors: (ColorRow & { product_images: ImageRow[] })[],
  category: Product["category"],
): Angle[] {
  const preferred = angleOrder(category);
  const orderOf = (angle: Angle) => {
    const index = preferred.indexOf(angle);
    return index === -1 ? preferred.length + ALL_ANGLES.indexOf(angle) : index;
  };

  const seen = new Set<Angle>();
  const derived: Angle[] = [];

  for (const color of colors) {
    const images = [...(color.product_images ?? [])].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (isAngle(a.angle) ? orderOf(a.angle) : 999) -
          (isAngle(b.angle) ? orderOf(b.angle) : 999),
    );

    for (const image of images) {
      if (!image.image_url || !isAngle(image.angle) || seen.has(image.angle)) continue;
      seen.add(image.angle);
      derived.push(image.angle);
    }
  }

  return derived.length > 0 ? derived : categoryAngles(category);
}

/** A row plus its relations into the app's `Product`. */
export function toProduct(row: ProductWithRelations): Product {
  const category = isCategory(row.category) ? row.category : "bag";

  const sortedColors = [...(row.product_colors ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.color_name.localeCompare(b.color_name),
  );

  /* The admin can choose any subset of the eight views, so the product's roll
     comes from its actual image rows. A product with no photography falls back
     to the category's default five placeholders. */
  const angles = productAngles(sortedColors, category);

  const colors = sortedColors.map((color) =>
    toColorVariant(color, color.product_images ?? [], angles),
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    basePrice: row.base_price,
    basePriceUsd: row.base_price_usd ?? null,
    discountPercent: row.discount_percent,
    stockQuantity: row.stock_quantity,
    featured: row.featured,
    /* `active` has no counterpart on the domain type on purpose. The shop's read
       path never sees an inactive row — RLS hides it — so the flag belongs to the
       admin, not to the product. It is carried through admin reads separately;
       see `lib/admin-api.ts`. */
    colors,
    category,
    categoryId: row.category_id ?? null,
    angles,
    createdAt: row.created_at,
  };
}

/**
 * The shape the admin works with: a `Product` plus the flags and ids the shop has
 * no reason to know about.
 *
 * Separate from `Product` on purpose. `Product` is what the shop renders, and
 * adding `active` to it would invite `!product.active` into a storefront check
 * that RLS already guarantees is unnecessary.
 */
export interface AdminProduct extends Product {
  /** Hidden from the shop, visible here. The only reason this type exists. */
  active: boolean;
}

/** The row shape `lib/admin-api.ts` reads. Same relation nesting as above. */
export type AdminProductRow = ProductRow & {
  product_colors: (ColorRow & { product_images: ImageRow[] })[];
  active: boolean;
};

/** An admin row plus its flags. */
export function toAdminProduct(row: AdminProductRow): AdminProduct {
  return { ...toProduct(row), active: row.active };
}

/** The default `Angle[]` for a category. Live products use their own `angles`. */
export function anglesForCategory(category: string): Angle[] {
  return categoryAngles(isCategory(category) ? category : "bag");
}