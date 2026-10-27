import { z } from "zod";

import type { Angle, Product } from "@/lib/types";

/**
 * ============================================================================
 * Validation for the admin's inputs.
 * ============================================================================
 *
 * Shared between the client form and the server actions, which is the only reason
 * this file exists. The same schema runs in both places on purpose:
 *
 *   - In the form, so somebody is told about an empty name before they press Save
 *     rather than after.
 *   - In the action, because a server action is a **public HTTP endpoint**. Anything
 *     that calls it can send anything, so client-side validation is a convenience
 *     for the person filling the form in, not a control. The rules that protect the
 *     database are the ones that run here.
 *
 * One schema, used twice, means the two can never disagree about what is valid.
 * When the form says "that is fine" and the action says "no", the bug is in the
 * wiring and not in two copies of the rules.
 */

/* ---------------------------------------------------------------------------
   Kenyan phone numbers
   --------------------------------------------------------------------------- */

/** The country code shown as a fixed prefix in the checkout field. */
export const KENYAN_PHONE_PREFIX = "+254";

/** 254 + a nine-digit mobile number. Kenyan mobiles start with 7 or 1. */
const KENYAN_PHONE_PATTERN = /^\+254[17]\d{8}$/;

/**
 * The nine local digits in whatever the shopper typed or pasted.
 *
 * Accepts every shape the field can receive — `712345678`, `0712345678`,
 * `+254 712 345 678`, `254712345678` and `00254712345678` — and reduces it to
 * the digits that follow `+254`. Deliberately does **not** truncate: the schema
 * below must be able to reject a number that is too long, while the form's
 * `onChange` handler is the layer that caps the visible value at nine digits.
 */
function kenyanLocalDigits(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("254")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  return digits;
}

/**
 * What the controlled input stores: at most the nine digits after `+254`.
 *
 * Pasting `0712345678` or `+254712345678` therefore lands as `712345678`, with
 * the visual `+254` prefix still in place.
 */
export function kenyanPhoneLocalDigits(value: string): string {
  return kenyanLocalDigits(value).slice(0, 9);
}

/** Normalise any accepted shape to the one format the server stores. */
export function normalizeKenyanPhone(value: string): string {
  return `${KENYAN_PHONE_PREFIX}${kenyanLocalDigits(value)}`;
}

/**
 * The checkout/server phone rule.
 *
 * The transform runs first, so both the client and the server see the same
 * canonical output (`+254712345678`) no matter which format was submitted.
 */
export const kenyanPhoneSchema = z
  .string({ message: "Enter your phone number" })
  .trim()
  .transform(normalizeKenyanPhone)
  .refine((value) => KENYAN_PHONE_PATTERN.test(value), {
    message:
      "Enter the 9 digits after +254, for example 712345678.",
  });

/** A CSS hex colour. The same six-digit form the swatches use. */
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour, for example #8B4513");

/** Whole shillings. See the note on money in 001_initial.sql. */
const shillings = z.coerce
  .number({ message: "Enter a price in shillings" })
  .int("Prices are whole shillings")
  .min(0, "A price cannot be negative")
  .max(10_000_000, "That looks too large for a price");

const stockCount = z.coerce
  .number({ message: "Enter a stock quantity" })
  .int("Stock is a whole number")
  .min(0, "Stock cannot be negative")
  .max(100_000, "That looks too large for a stock count");

const percent = z.coerce
  .number({ message: "Enter a discount percentage" })
  .int("Discounts are whole percentages")
  .min(0, "A discount cannot be negative")
  .max(99, "A discount must be under 100 — 100% or more would make the price zero or negative");

export const colorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the colour a name")
    .max(40, "That colour name is too long"),
  hex: hexColor,
});

/** Angles, for validation and the form's slot list. Mirrors the CHECK in 001_initial.sql. */
const ANGLES = [
  "front",
  "side-left",
  "side-right",
  "side",
  "top",
  "bottom",
  "back",
  "laces",
] as const satisfies readonly Angle[];

export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the product a name")
    .max(80, "That product name is too long"),

  slug: z
    .string()
    .trim()
    .min(2, "Give the product a URL slug")
    .max(80, "That slug is too long")
    /* Lowercase letters, digits and single hyphens. Deliberately stricter than the
       column, which only demands uniqueness: a slug with an underscore or a space
       in it looks like a mistake in a URL bar and can break a shared link. */
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens"),

  description: z
    .string()
    .trim()
    .min(1, "Write at least a sentence about this piece")
    .max(600, "That description is too long for a card"),

  category: z.enum(["bag", "shoe"], { message: "Choose a category" }),
  categoryId: z.string().uuid("Invalid category").nullable().optional(),

  basePrice: shillings,
  basePriceUsd: z.coerce.number().int().min(1, "USD price must be positive").max(1_000_000, "That looks too large for a USD price").optional().nullable(),
  discountPercent: percent,
  stockQuantity: stockCount,

  featured: z.boolean(),
  active: z.boolean(),

  colors: z
    .array(colorSchema)
    .min(1, "Add at least one colour")
    .max(8, "Eight colours is the most the swatch row can show")
    .refine(
      (colors) =>
        new Set(colors.map((color) => color.name.trim().toLowerCase())).size ===
        colors.length,
      {
        message: "Two of the colours have the same name. Give each one a distinct name.",
        path: ["colors"],
      },
    ),

  /*
   * Images are a list, not an object keyed by angle, so the admin's slot order
   * survives the round trip. Only non-empty slots are sent at all, which means a
   * product with three photographs creates three rows — not eight rows, five of
   * them null.
   */
  images: z.record(
    z.coerce.number(),
    z
      .array(
        z.object({
          angle: z.enum(ANGLES),
          url: z.string().url("That is not a valid image URL"),
        }),
      )
      .max(ANGLES.length, "That colour has more image slots than views")
      .refine(
        (images) => new Set(images.map((image) => image.angle)).size === images.length,
        "A colour can only use each view once",
      ),
  ),
});

/**
 * A product as the form collects it, before validation.
 *
 * Deliberately loose: the form holds strings while somebody is typing, and `z.coerce`
 * turns them into numbers at the boundary rather than the form having to know that.
 */
export type ProductFormValues = z.input<typeof productInputSchema>;
/** And after. What `lib/admin-api.ts` wants. */
export type ValidatedProductInput = z.output<typeof productInputSchema>;

/** Narrow a database string to an `Angle`, or null. Mirrors `isAngle` in mappers. */
export function parseAngle(value: string): Angle | null {
  return (ANGLES as readonly string[]).includes(value) ? (value as Angle) : null;
}

const quickFieldSchema = z.enum(["stock_quantity", "discount_percent", "featured", "active"]);

/** The inline table editor's single-field save. */
export const quickFieldEditSchema = z.object({
  field: quickFieldSchema,
  /* Accepts both, because a table cell can hold either and the action does not know
     which row it is being called for. `z.union` rather than `z.any`, so a typo is a
     validation error instead of a write of `undefined`. */
  value: z.union([z.number(), z.boolean()]),
});

/**
 * Turn a Zod failure into something worth showing a person.
 *
 * `error.issues[0].message` is written for a developer, and this is the only place a
 * developer's wording reaches a shopkeeper's screen, so each message above is
 * written as a sentence addressed to them. The field path is included so the form can
 * point at the right input.
 */
export function firstError(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  if (!issue) return { field: "form", message: "Something is wrong with this form." };
  return {
    /* `colors.1.hex` -> `colors[1].hex`, which is what the form's field names look
       like. */
    field: issue.path.map(String).join(".").replace(/(\d+)\./g, "[$1]."),
    message: issue.message,
  };
}

/** `Product["category"]`, for callers that need the type rather than the value. */
export type Category = Product["category"];

/* ---------------------------------------------------------------------------
   Category validation
   --------------------------------------------------------------------------- */

const slugBase = z
  .string()
  .trim()
  .min(2, "Give the category a slug")
  .max(80, "That slug is too long")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens");

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the category a name")
    .max(80, "That category name is too long"),
  slug: slugBase,
  parentId: z.string().uuid("Invalid category").nullable().optional(),
  displayOrder: z.coerce
    .number()
    .int("Display order must be a whole number")
    .min(0, "Display order cannot be negative")
    .default(0),
  isActive: z.boolean().default(true),
});

export type CategoryFormValues = z.input<typeof categorySchema>;
export type ValidatedCategoryInput = z.output<typeof categorySchema>;