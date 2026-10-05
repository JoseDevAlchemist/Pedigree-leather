import type { Angle, ColorVariant, Product } from "@/lib/types";

/**
 * Placeholder data, standing in for the admin API until it exists.
 *
 * Components must never import this file — read products through `lib/api.ts`
 * instead, so swapping in a real fetch is a one-file change.
 *
 * `createdAt` values are hard-coded rather than computed from `Date.now()`:
 * a mock that re-dates itself on every render would make the "New Arrivals"
 * ordering untestable, and would shift the prerendered HTML between builds.
 * They are spread over the 30 days before 2026-10-04.
 *
 * `featured: true` is set by hand. A featured rail is merchandising: it should
 * not spend one of its slots on something a shopper cannot buy or is unlikely
 * to be able to, so the sold-out Rift Valley Backpack, the three-left Karen
 * Briefcase and the sold-out Lamu Chukka are all excluded.
 *
 * Prices sit where they do for a reason rather than by taste: a bag is one hide
 * and a pair of shoes is two, so the shoe band runs below the bag band even
 * though a welted sole is more work per square inch.
 */

/**
 * A slot for every `Angle`, for every colourway.
 *
 * All of them null, because there is no photography yet. Writing out all eight
 * rather than only the five a bag uses is deliberate: it is what lets
 * `color.images[angle] ?? null` stay total, so adding an angle to a product
 * needs no change here and a shoe's `laces` slot is simply empty.
 */
function pendingImages(): Record<Angle, string | null> {
  return {
    front: null,
    "side-left": null,
    "side-right": null,
    side: null,
    top: null,
    bottom: null,
    back: null,
    laces: null,
  };
}

function color(id: string, name: string, hex: string): ColorVariant {
  return { id, name, hex, images: pendingImages() };
}

/* A fixed palette, reused across products so the grid reads as one collection
   rather than a colour chart. These are real leather dye values.
   The constants are shared object references, so MOCK_PRODUCTS must be treated
   as read-only — which is what a real fetch would hand back anyway. */
const COGNAC = color("cognac", "Cognac", "#8B4513");
const BLACK = color("black", "Black", "#1C1C1C");
const TAN = color("tan", "Tan", "#C19A6B");
const OXBLOOD = color("oxblood", "Oxblood", "#4A1C1C");
const CREAM = color("cream", "Cream", "#EFE3D2");
const FOREST = color("forest", "Forest", "#2D3E2D");

/**
 * Roll order per category, and the reason each list is shaped the way it is.
 *
 * Bags get both flanks, because a bag's two sides are genuinely different shapes
 * — a satchel's turn-lock only appears on one of them. A shoe has one visible
 * side per photograph, so it gets a single `side` instead of two near-identical
 * shots and spends that slot on `laces` and `bottom` instead. `laces` sits second
 * because the lacing is the part of a shoe most worth seeing after the front.
 * `bottom` is last because the sole is a reference shot, not an angle anyone
 * browses to.
 *
 * Functions, not constants: every product gets its own array, because
 * `Product.angles` is a mutable `Angle[]` and a shared reference would let one
 * product's roll order rewrite another's. The colourway constants above are
 * shared on purpose — nothing ever mutates a swatch.
 */
const bagAngles = (): Angle[] => ["front", "side-left", "side-right", "top", "back"];
const shoeAngles = (): Angle[] => ["front", "laces", "side", "back", "bottom"];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "bag-karura-tote",
    slug: "karura-tote",
    name: "Karura Tote",
    description:
      "A wide-mouth tote in full-grain leather that stands up on its own. It is unlined and open at the top, so it packs flat when it is empty.",
    basePrice: 18500,
    discountPercent: 0,
    stockQuantity: 12,
    category: "bag",
    colors: [COGNAC, BLACK, FOREST, TAN],
    angles: bagAngles(),
    featured: true,
    createdAt: "2026-09-05T08:00:00.000Z",
  },
  {
    id: "bag-ngong-satchel",
    slug: "ngong-satchel",
    name: "Ngong Satchel",
    description:
      "A flat satchel with one flap and a solid brass turn-lock, cut from a single hide so the grain runs unbroken across the front. Fits a 13-inch laptop and a folio.",
    basePrice: 14000,
    discountPercent: 15,
    stockQuantity: 8,
    category: "bag",
    colors: [OXBLOOD, COGNAC, BLACK],
    angles: bagAngles(),
    featured: true,
    createdAt: "2026-09-08T11:30:00.000Z",
  },
  {
    id: "bag-kilimanjaro-weekender",
    slug: "kilimanjaro-weekender",
    name: "Kilimanjaro Weekender",
    description:
      "Sized for two nights, with a wide gusset, a reinforced base and a shoulder strap that detaches and stows in the side pocket. Forty-five litres.",
    basePrice: 23500,
    discountPercent: 0,
    stockQuantity: 5,
    category: "bag",
    colors: [BLACK, TAN, OXBLOOD],
    angles: bagAngles(),
    featured: true,
    createdAt: "2026-09-14T16:20:00.000Z",
  },
  {
    id: "bag-rift-valley-backpack",
    slug: "rift-valley-backpack",
    name: "Rift Valley Backpack",
    description:
      "A roll-top pack with waxed canvas side panels and a flap that stiffens as it ages. The roll closure keeps rain out and takes up less room than a zip does when the bag is half empty.",
    basePrice: 16500,
    discountPercent: 10,
    stockQuantity: 0,
    category: "bag",
    colors: [FOREST, BLACK, CREAM, COGNAC],
    angles: bagAngles(),
    featured: false,
    createdAt: "2026-09-21T10:05:00.000Z",
  },
  {
    id: "bag-lamu-crossbody",
    slug: "lamu-crossbody",
    name: "Lamu Crossbody",
    description:
      "A small flat bag on a thin strap, for a phone, a card holder and keys. It is the thinnest thing we make, roughly the size of a paperback.",
    basePrice: 9500,
    discountPercent: 20,
    stockQuantity: 15,
    category: "bag",
    colors: [CREAM, TAN, BLACK],
    angles: bagAngles(),
    featured: true,
    createdAt: "2026-09-29T14:40:00.000Z",
  },
  {
    id: "bag-karen-briefcase",
    slug: "karen-briefcase",
    name: "Karen Briefcase",
    description:
      "A structured briefcase with a three-part zip gusset, so it opens flat for a laptop and closes to a hard line for the office. Brass feet underneath keep it off a wet floor.",
    basePrice: 22000,
    discountPercent: 0,
    stockQuantity: 3,
    category: "bag",
    colors: [OXBLOOD, BLACK, TAN],
    angles: bagAngles(),
    featured: false,
    createdAt: "2026-10-03T09:12:00.000Z",
  },

  /* ---------------------------------------------------------------------
     Shoes. Same palette, same five angles, different craft vocabulary: a
     shoe's description talks about the welt and the last, not about a gusset,
     and its price band sits below the bags' because a pair is two hides.
     --------------------------------------------------------------------- */
  {
    id: "shoe-karura-derby",
    slug: "karura-derby",
    name: "Karura Derby",
    description:
      "An open-laced derby cut from a single hide, so the vamp and the quarters are the same leather. Goodyear-welted, so it can be resoled rather than replaced.",
    basePrice: 18500,
    discountPercent: 0,
    stockQuantity: 8,
    category: "shoe",
    colors: [COGNAC, BLACK, TAN],
    angles: shoeAngles(),
    featured: true,
    createdAt: "2026-09-06T08:45:00.000Z",
  },
  {
    id: "shoe-nyota-derby",
    slug: "nyota-derby",
    name: "Nyota Derby",
    description:
      "Hand-stitched leather derby with a Goodyear-welted sole and a burnished finish that deepens where your foot flexes it.",
    basePrice: 16500,
    discountPercent: 10,
    stockQuantity: 6,
    category: "shoe",
    colors: [OXBLOOD, BLACK, COGNAC],
    angles: shoeAngles(),
    featured: true,
    createdAt: "2026-09-11T13:15:00.000Z",
  },
  {
    id: "shoe-turkana-loafer",
    slug: "turkana-loafer",
    name: "Turkana Loafer",
    description:
      "A moccasin-stitched loafer with no laces and no heel, so it packs flat. Unlined, and it creases along the vamp the way a shoe should.",
    basePrice: 12500,
    discountPercent: 0,
    stockQuantity: 11,
    category: "shoe",
    colors: [TAN, COGNAC, CREAM],
    angles: shoeAngles(),
    featured: false,
    createdAt: "2026-09-17T10:30:00.000Z",
  },
  {
    id: "shoe-lamu-chukka",
    slug: "lamu-chukka",
    name: "Lamu Chukka",
    description:
      "Two eyelets, a storm welt and a crepe sole. The lightest thing we make on a last, and the one that wears a scuff fastest.",
    basePrice: 14500,
    discountPercent: 0,
    stockQuantity: 0,
    category: "shoe",
    colors: [FOREST, BLACK, TAN],
    angles: shoeAngles(),
    featured: false,
    createdAt: "2026-09-23T15:05:00.000Z",
  },
  {
    id: "shoe-rift-valley-boot",
    slug: "rift-valley-boot",
    name: "Rift Valley Boot",
    description:
      "A six-eyelet service boot on a commando sole, stitched at 6 stitches to the inch so it can be repaired at any cobbler in the country.",
    basePrice: 22000,
    discountPercent: 15,
    stockQuantity: 4,
    category: "shoe",
    colors: [BLACK, FOREST, COGNAC],
    angles: shoeAngles(),
    featured: false,
    createdAt: "2026-09-26T09:00:00.000Z",
  },
  {
    id: "shoe-karura-derby-suede",
    slug: "karura-derby-suede",
    name: "Karura Derby in Suede",
    description:
      "The same last as our plain derby, in a waxed suede that beads in the rain and dries to a different shade every time. Goodyear-welted like the rest.",
    basePrice: 17500,
    discountPercent: 0,
    stockQuantity: 7,
    category: "shoe",
    colors: [TAN, COGNAC, FOREST],
    angles: shoeAngles(),
    featured: true,
    createdAt: "2026-10-01T11:20:00.000Z",
  },
];