import type { Angle, ColorVariant, Product } from "@/lib/types";

/**
 * Placeholder data, standing in for the admin API until it exists.
 *
 * Components must never import this file — read products through `lib/api.ts`
 * instead, so swapping in a real fetch is a one-file change.
 *
 * Every `images` value is `null` because there is no photography yet. The UI
 * treats `null` as "show the colour block", so these slots fill in without any
 * component needing to know whether the images exist.
 *
 * `createdAt` values are hard-coded rather than computed from `Date.now()`:
 * a mock that re-dates itself on every render would make the "New Arrivals"
 * ordering untestable, and would shift the prerendered HTML between builds.
 * They are spread over the 30 days before 2026-10-04.
 *
 * `featured: true` is set by hand on four bags. The sold-out Rift Valley
 * Backpack and the three-left Karen Briefcase are deliberately excluded: a
 * featured rail is merchandising, and it should not spend one of its four slots
 * on something a shopper cannot buy or is unlikely to be able to.
 */

function pendingImages(): Record<Angle, string | null> {
  return {
    front: null,
    "side-left": null,
    "side-right": null,
    top: null,
    back: null,
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
    featured: false,
    createdAt: "2026-10-03T09:12:00.000Z",
  },
];