import type { Angle } from "@/lib/types";

/**
 * Angle helpers.
 *
 * `ALL_ANGLES` is the vocabulary the database can store. A product's own
 * `angles` array is the subset and order it actually uses, and every positional
 * helper below takes that array rather than a global count. The roll order, the
 * dots and the "1 / 5" counter are therefore per product: a bag might ship with
 * five views, three views, or all eight, and a product with four photographs
 * must not inherit five dots.
 */

/**
 * Every view the database can store, in a stable display order.
 *
 * This is the full vocabulary, not any one product's slot list. The admin may
 * use any subset of these views, and may use as few as one — see
 * `angleOrder()` and `categoryAngles()` for the preferred starting order.
 */
export const ALL_ANGLES: readonly Angle[] = [
  "front",
  "side-left",
  "side-right",
  "side",
  "top",
  "bottom",
  "back",
  "laces",
];

/**
 * The default views for a category, in roll order.
 *
 * This is still the default *starting point* — a new bag form opens with these
 * five slots, and a product with no photographs has these five placeholder
 * slots. It is no longer a hard limit: the admin can remove any slot and add
 * any unused view from `ALL_ANGLES`, so a product can ship with three
 * photographs or all eight.
 *
 * It is deliberately a function rather than a stored column. A bag's two flanks
 * are different shapes, so a bag starts with `side-left` and `side-right`; a
 * shoe has one visible side per photograph, so it starts with a single `side`
 * and spends the slot on `laces` and the `bottom` welt instead.
 */
export function categoryAngles(category: "bag" | "shoe"): Angle[] {
  return category === "shoe"
    ? ["front", "laces", "side", "back", "bottom"]
    : ["front", "side-left", "side-right", "top", "back"];
}

/**
 * Every angle in the order the admin should offer it for this category.
 *
 * Category defaults first, then the remaining views. Used by the form's "Add
 * image slot" button and by the read path when legacy rows have no sort order.
 */
export function angleOrder(category: "bag" | "shoe"): Angle[] {
  const preferred = categoryAngles(category);
  return [
    ...preferred,
    ...ALL_ANGLES.filter((angle) => !preferred.includes(angle)),
  ];
}

/**
 * Short display labels. These are stamped onto the placeholder and shown in the
 * card's corner, where horizontal space is scarce — hence "Side L" rather than
 * "Side left". Use `angleSpoken` for anything a screen reader will read.
 */
export const ANGLE_LABELS: Record<Angle, string> = {
  front: "Front",
  "side-left": "Side L",
  "side-right": "Side R",
  side: "Side",
  top: "Top",
  bottom: "Bottom",
  back: "Back",
  laces: "Laces",
};

/**
 * Spoken labels, for alt text and `aria-label`. "Side L view" is fine stamped on
 * a leather swatch and wrong in a sentence read aloud, so the two are kept apart.
 */
const ANGLE_SPOKEN: Record<Angle, string> = {
  front: "front",
  "side-left": "left side",
  "side-right": "right side",
  side: "side",
  top: "top",
  bottom: "sole",
  back: "back",
  laces: "laces",
};

/** The view at `index` in this product's roll, falling back to the first view. */
export function angleAt(index: number, angles: readonly Angle[]): Angle {
  return angles[index] ?? angles[0];
}

/** Short display label, e.g. "Side L". Stamped on the placeholder. */
export function angleLabel(angle: Angle): string {
  return ANGLE_LABELS[angle];
}

/** Lower-case label for alt text and `aria-label`, e.g. "left side". */
export function angleSpoken(angle: Angle): string {
  return ANGLE_SPOKEN[angle];
}

/**
 * Clamp any number into the valid index range for this product. The dots, the
 * arrows and the roll all call this, so nothing can address an angle the product
 * does not have — including a stale timer from a previous product id.
 */
export function clampIndex(index: number, count: number): number {
  if (Number.isNaN(index) || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

/** Step through angles, stopping at either end rather than wrapping. */
export function stepIndex(index: number, delta: number, count: number): number {
  return clampIndex(index + delta, count);
}

/** Wrap forward one step, for the timed roll, which loops rather than stopping. */
export function nextIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (clampIndex(index, count) + 1) % count;
}

export function isFirstIndex(index: number, count: number): boolean {
  return clampIndex(index, count) === 0;
}

export function isLastIndex(index: number, count: number): boolean {
  return clampIndex(index, count) === count - 1;
}

/**
 * Where an angle sits in the roll, or -1 if this product does not have it.
 *
 * Used by the hover roll: the cursor's position names a *view* ("the left side"),
 * and this finds which of this product's angles is that view. The two lists are
 * related but not identical — a bag has `side-left` and `side-right`, a shoe has
 * one `side` — so the lookup has to go through the product rather than assuming
 * positions line up.
 */
export function angleIndexOf(angles: readonly Angle[], angle: Angle): number {
  return angles.indexOf(angle);
}