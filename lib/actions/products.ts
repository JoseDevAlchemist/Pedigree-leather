"use server";

import { revalidatePath } from "next/cache";

import {
  createProduct as createProductRow,
  deleteProduct as deleteProductRow,
  getProduct,
  listProducts,
  updateProduct as updateProductRow,
  updateProductField as updateProductFieldRow,
} from "@/lib/admin-api";
import type { ProductInput, QuickField } from "@/lib/admin-api";
import { requireAdminUser } from "@/lib/supabase/guards";
import { firstError, productInputSchema, quickFieldEditSchema } from "@/lib/validation";

/**
 * ============================================================================
 * Server actions for the admin product pages.
 * ============================================================================
 *
 * A server action is a public HTTP endpoint. Whatever renders a form can have its
 * `action` attribute invoked by anything that can reach the URL, so every function
 * here assumes its arguments are hostile:
 *
 *   1. **Check the session** — `requireAdminUser()` first, before touching arguments.
 *      An unauthenticated call must not even reach the validator, let alone the
 *      database.
 *   2. **Validate with Zod** — the client's copy of the same schema is for
 *      convenience, not enforcement.
 *   3. **Only then call `lib/admin-api.ts`**, which is the only thing that talks to
 *      the database.
 *
 * Nothing here talks to Supabase directly, and nothing returns an `Error` object or a
 * raw Postgres message. Callers get `{ ok, data }` or `{ ok, error }` with a sentence
 * they can put on screen.
 */

/** The shape every action returns. `data` is only present when `ok` is true. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A Postgres error, turned into something worth showing a person.
 *
 * The raw message from PostgREST is developer text: "duplicate key value violates
 * unique constraint products_slug_key". That is accurate and useless on a screen.
 * The two cases an admin will actually hit get a sentence; anything else is logged in
 * full and reported generically, because an unexpected database error should be
 * diagnosed from the server log, not from a toast.
 */
function explain(error: unknown, context: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? "";

  console.error(`[admin/products] ${context}:`, error);

  if (code === "23505" || /duplicate key value violates unique constraint/i.test(message)) {
    if (/products_slug_key/.test(message)) {
      return "That URL slug is already in use. Pick another — the name can stay the same.";
    }
    if (/product_colors_product_id_color_name_key/.test(message)) {
      return "Two of the colours have the same name. Give each one a distinct name.";
    }
    return "One of those values is already used by another product.";
  }

  if (code === "23503" || /foreign key violation/i.test(message)) {
    return "That product is still referenced by something else. Try deleting it from the products list instead.";
  }

  if (code === "23514" || /violates check constraint/i.test(message)) {
    return "One of the values is outside what the database allows. Check the category, price and discount.";
  }

  if (/row-level security/i.test(message)) {
    return "The database refused this change. Check that 001_initial.sql has been run and that you are signed in.";
  }

  return "Something went wrong saving that. The details are in the server log.";
}

/** Auth, then delegate. Keeps the four actions from repeating themselves. */
async function guarded<T>(
  what: string,
  run: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    await requireAdminUser();
    return { ok: true, data: await run() };
  } catch (error) {
    /* A thrown redirect from `requireAdminUser` is not an error to report — it is
       navigation, and re-wrapping it would turn a redirect into a toast. */
    if (isRedirect(error)) throw error;
    return { ok: false, error: explain(error, what) };
  }
}

/** `redirect()` signals by throwing an error with a private digest property. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Create a product.
 *
 * `revalidatePath("/")` afterwards because the shop's pages are statically
 * prerendered: a new product is on its own page immediately (`dynamicParams`
 * defaults to true, so the slug renders on demand) but it will not appear in the home
 * page's featured rail, the new-arrivals grid or a category grid until those are
 * revalidated. That is the one gap in the static build, and this is where it gets
 * closed.
 */
export async function createProductAction(input: unknown): Promise<ActionResult<unknown>> {
  return guarded("createProduct", async () => {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const { message } = firstError(parsed.error);
      throw new ValidationError(message);
    }

    const created = await createProductRow(parsed.data as ProductInput);
    revalidateShop();
    return created;
  });
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult<unknown>> {
  return guarded("updateProduct", async () => {
    if (!id) throw new ValidationError("No product was named to update.");

    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const { message } = firstError(parsed.error);
      throw new ValidationError(message);
    }

    const updated = await updateProductRow(id, parsed.data as ProductInput);
    revalidateShop();
    return updated;
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult<null>> {
  return guarded("deleteProduct", async () => {
    if (!id) throw new ValidationError("No product was named to delete.");

    await deleteProductRow(id);
    revalidateShop();
    return null;
  });
}

/**
 * The inline stock / discount / featured / active edit.
 *
 * Revalidates only the admin tree. This writes one column of one row, so it cannot
 * change what the shop shows except in the case of `active` — but `revalidateShop`
 * is not worth its cost on every keystroke committed in a table, and `active` is
 * rare enough that revalidating `/admin` plus the shop on that field alone is a
 * reasonable trade.
 */
export async function updateFieldAction(
  id: string,
  field: unknown,
  value: unknown,
): Promise<ActionResult<unknown>> {
  return guarded("updateProductField", async () => {
    if (!id) throw new ValidationError("No product was named to update.");

    const parsed = quickFieldEditSchema.safeParse({ field, value });
    if (!parsed.success) {
      const { message } = firstError(parsed.error);
      throw new ValidationError(message);
    }

    /* `stock_quantity` and `discount_percent` are integer columns. A table cell can
       hand over a string, and Postgres will refuse a text value for an integer
       column with an error nobody wants to read — so the range is re-checked here
       rather than trusted. `updateProductField` coerces; this refuses the values that
       have no business existing. */
    const numeric = parsed.data.value;
    if (typeof numeric === "number") {
      if (!Number.isInteger(numeric) || numeric < 0) {
        throw new ValidationError("Enter a whole number of zero or more.");
      }
      if (parsed.data.field === "discount_percent" && numeric > 99) {
        throw new ValidationError("A discount must be under 100.");
      }
    }

    const updated = await updateProductFieldRow(id, parsed.data.field as QuickField, numeric);

    if (parsed.data.field === "active") revalidateShop();
    else revalidatePath("/admin", "layout");

    return updated;
  });
}

/** Read-side helpers the admin's client components call. Auth-checked like writes. */
export async function listProductsAction(filters?: {
  category?: "bag" | "shoe";
  search?: string;
}): Promise<ActionResult<unknown>> {
  return guarded("listProducts", async () => listProducts(filters));
}

export async function getProductAction(id: string): Promise<ActionResult<unknown>> {
  return guarded("getProduct", async () => {
    if (!id) throw new ValidationError("No product was named.");
    return getProduct(id);
  });
}

/**
 * A validation failure, marked so `explain` can pass the sentence through untouched.
 *
 * Without this, a Zod message would be logged and then replaced by the generic
 * "something went wrong", which is exactly backwards: the validation message is the
 * one the person can act on.
 */
class ValidationError extends Error {
  override name = "ValidationError";
}

function revalidateShop() {
  /* The shop's static pages: home, and both category grids. The detail pages are
     not revalidated because their slugs are unknown here, and they do not need to
     be — a changed product's own page is fetched on demand. */
  revalidatePath("/");
  revalidatePath("/bags");
  revalidatePath("/shoes");
}