import type { Angle } from "@/lib/types";

/**
 * Angle helpers.
 *
 * There is no global angle list any more. Every function that used to clamp
 * against `ANGLES.length` now takes the product's own `angles` array, because
 * the roll order, the dots and the "1 / 5" counter are all per product: a bag
 * rolls through five views and a shoe through five *different* views, and a
 * product with four photographs must not inherit five dots.
 */

/**
 * The views each category is photographed from, in roll order.
 *
 * This is the single source of truth for "which views does a product of this kind
 * have", and three things read it: the shop's read path (to build the image slots
 * for a product row), the admin's form (to decide which upload slots to draw), and
 * the mock data (which asserts against it).
 *
 * It is deliberately a function rather than a stored column. A bag's two flanks
 * are different shapes, so a bag gets `side-left` and `side-right`; a shoe has one
 * visible side per photograph, so it gets a single `side` and spends the slot on
 * `laces` and the `bottom` welt instead. Storing that list per product would mean
 * every row carries a value that has to agree with its category, and nothing could
 * ever be added to the shoot list without a migration.
 */
export function categoryAngles(category: "bag" | "shoe"): Angle[] {
  return category === "shoe"
    ? ["front", "laces", "side", "back", "bottom"]
    : ["front", "side-left", "side-right", "top", "back"];
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