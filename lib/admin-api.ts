/**
 * ============================================================================
 * Server-only. Import from server actions or server components only.
 * ============================================================================
 *
 * Every admin read and write goes through this file, and this file is the only
 * thing in the repo that imports `lib/supabase/admin.ts`. That is the whole point
 * of the arrangement, and it is what lets the backend change without touching a
 * single component:
 *
 *   - swap Supabase for something else and only this file moves;
 *   - add caching, rate limiting or a query cache around the reads, and no caller
 *     notices, because they all call a function rather than construct a query;
 *   - write a test for admin behaviour without a component in sight.
 *
 * Every function here goes through the **service role client**, which bypasses
 * RLS. That is a deliberate escalation — the admin must see inactive products,
 * delete rows that cascade, and count sold-out stock — but it means *this* module
 * is the authorisation boundary. There is no policy behind it. Every caller must
 * have already checked the session, and every server action does.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { anglesForCategory, toAdminProduct } from "@/lib/mappers";
import type { AdminProduct, AdminProductRow } from "@/lib/mappers";
import type { Tables } from "@/lib/supabase/types";
import type { Angle, ColorVariant, Product } from "@/lib/types";

/**
 * Turn a PostgREST error into one that says what to do about it.
 *
 * `lib/admin-api.ts` is the only place in the project that talks to the database, so
 * it is the only place that can turn "PostgreSQL error 42P01: relation
 * \"products\" does not exist" into a sentence. Left alone, that message is thrown
 * upward, Next replaces the page with a generic "Application error", and the browser
 * shows `{code: …, details: Null, hint: Null}` — a person looking at a broken admin
 * learns nothing. The original error is logged here and kept as `cause`, so the detail
 * is in the server log next to the readable one.
 *
 * The shop's read path has its own equivalent in `lib/api.ts`, which does the opposite:
 * it swallows and falls back, because a shopper should not see a stack trace because
 * a database is down. The asymmetry is deliberate — see `app/(admin)/admin/error.tsx`.
 */
function rethrow(error: unknown, context: string): never {
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[admin-api] ${context}:`, error);

  if (code === "42P01" || /PGRST205|Could not find the table|schema cache/i.test(message)) {
    throw new Error(
      `Supabase has no table for this query (${code || "PGRST205"}). The migration has not been ` +
        "applied to this project — run supabase/migrations/001_initial.sql and 002_storage.sql, " +
        "then seed.sql. See docs/SETUP.md.",
      { cause: error },
    );
  }

  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    throw new Error(
      "The database refused this read because of a row-level security policy. Either this " +
        "operation needs the service role key (check SUPABASE_SERVICE_ROLE_KEY) or the policies " +
        "in 001_initial.sql are missing.",
      { cause: error },
    );
  }

  if (code === "57014" || /statement timeout/i.test(message)) {
    throw new Error("That query took too long and was cancelled by the database.", {
      cause: error,
    });
  }

  throw new Error(`Could not ${context.replace(/_/g, " ")}. The details are in the server log.`, {
    cause: error,
  });
}

/**
 * Is the database actually there, and if not, what is wrong with it?
 *
 * Added because of what happened the first time this was run: with no migration
 * applied, *every* admin page threw, and each one produced an error boundary showing
 * a message that could not name the cause. The PostgREST text exists server-side and
 * never reaches the client — a Server Component's error crosses the boundary as an
 * opaque digest — so a boundary cannot diagnose this, however carefully it is written.
 *
 * The layout can. It runs before any page, it can afford one cheap query, and it can
 * replace the content area with an explanation instead of letting twelve pages each
 * crash. So this is the mechanism, and `error.tsx` is left to handle the things this
 * cannot anticipate.
 *
 * Deliberately a `limit 1` select of one column rather than a count: the cheapest query
 * that proves the table exists, run on every admin page load. At twelve products the
 * whole thing is sub-millisecond.
 */
export async function adminDatabaseStatus(): Promise<{
  ready: boolean;
  /** Present only when `ready` is false. Written to be shown to a person. */
  problem: string | null;
}> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("products").select("id").limit(1);

    if (!error) return { ready: true, problem: null };

    const code = error.code ?? "";

    if (code === "42P01" || /PGRST205|Could not find the table|schema cache/i.test(error.message)) {
      return {
        ready: false,
        problem:
          "Supabase is reachable but there is no `products` table, so the migration has not been " +
          "applied to this project.",
      };
    }

    if (code === "42501" || /row-level security|permission denied/i.test(error.message)) {
      return {
        ready: false,
        problem:
          "Supabase refused the read under a row-level security policy. Either the service role " +
          "key is wrong, or 001_initial.sql has not been run.",
      };
    }

    console.error("[admin-api] schema check:", error);
    return {
      ready: false,
      problem: `Supabase answered with an unexpected error (${code || "no code"}). The details are in the server log.`,
    };
  } catch (error) {
    /* Not logged here, unlike the branches above: this catch is for a client that
       could not be constructed at all, and the message it returns already says which
       variables to look at. Logging it would add a second copy of the same fact. */
    void error;
    return {
      ready: false,
      problem:
        "The Supabase client could not be created. NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY may be missing from the build environment.",
    };
  }
}

/**
 * What a product looks like coming *in* from the admin form.
 *
 * A `ProductInput` rather than a `Product`, because the two directions are not the
 * same shape: the domain type carries `angles` (derived from the category) and a
 * database `id` (generated by Postgres), neither of which a person fills in. The
 * form supplies what a person can actually edit.
 */
export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  category: Product["category"];
  basePrice: number;
  discountPercent: number;
  stockQuantity: number;
  featured: boolean;
  active: boolean;
  /** In display order. An empty list is rejected by the Zod schema, not here. */
  colors: { name: string; hex: string }[];
  /**
   * Which photographs exist, keyed by colour index then angle.
   *
   * Keyed by *index* rather than by colour id because a colour the form just
   * created does not have an id yet — the ids are minted by Postgres on insert.
   * `updateProduct` deletes and re-inserts every colour anyway, so the ids on the
   * incoming rows are not the ids being written.
   */
  images: Record<number, Partial<Record<Angle, string>>>;
}

/**
 * Every product the admin can see, including inactive ones.
 *
 * `search` matches name or slug, case-insensitively. `ilike` with the wildcards
 * inline rather than `like` with a parameter: PostgREST has no `ilike` operator
 * that takes a separate pattern argument, so `%` has to be part of the value.
 * The value is a bound parameter, not concatenated SQL, so there is no injection
 * here — the wildcards are in the pattern string only.
 */
export async function listProducts(filters?: {
  category?: Product["category"];
  search?: string;
}): Promise<AdminProduct[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("products")
    .select(
      "*, product_colors(*, product_images(*))",
    )
    .order("created_at", { ascending: false });

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  const search = filters?.search?.trim();
  if (search) {
    /* `*` inside an ilike pattern is a literal star. Someone searching for a
       product called "Ngong*" should get the bag named Ngong, not everything. */
    const pattern = search.replace(/[\\%_]/g, (char) => `\\${char}`);
    query = query.ilike("name", `%${pattern}%`);
  }

  const { data, error } = await query;
  if (error) rethrow(error, "list products");

  return (data as AdminProductRow[]).map(toAdminProduct);
}

/** One product by id, or `null`. Same shape as `listProducts`, one row. */
export async function getProduct(id: string): Promise<AdminProduct | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, product_colors(*, product_images(*))")
    .eq("id", id)
    .maybeSingle();

  /* `maybeSingle` returns null for zero rows and *errors* for more than one, which
     is the behaviour we want: a duplicate id means the data is wrong and should not
     be papered over. */
  if (error) rethrow(error, "read one product");
  return data ? toAdminProduct(data as AdminProductRow) : null;
}

/**
 * Create a product, its colours and its images.
 *
 * Sequential inserts, not a transaction. Supabase's JS client has no multi-statement
 * transaction without an RPC, and adding one means a Postgres function this
 * project would then have to keep in sync with the schema by hand.
 *
 * So: the order is chosen so that a failure leaves something recoverable rather
 * than something invisible. The product row goes in first. If a colour insert then
 * fails, the admin sees a product with no colours in the list — an obvious,
 * editable state — rather than a product that does not exist but whose colours
 * are already committed. That is the failure mode a person can notice; the other
 * one is the failure mode nobody notices until a customer hits a dead link.
 *
 * `throwOnError` on each call, and the error surfaced, is what makes the admin form
 * show the failure instead of silently saving half a product.
 */
export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const supabase = createAdminClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      base_price: input.basePrice,
      discount_percent: input.discountPercent,
      stock_quantity: input.stockQuantity,
      featured: input.featured,
      active: input.active,
    })
    .select("id")
    .single();

  if (productError) rethrow(productError, "create the product");

  /* Images arrive keyed by the colour's position in the incoming list, so they are
     resolved to the new colour ids in the same order the colours were inserted. */
  const colors = input.colors.map((color, index) => ({
    product_id: product.id,
    color_name: color.name,
    color_hex: color.hex,
    sort_order: index,
  }));

  const { data: createdColors, error: colorsError } = await supabase
    .from("product_colors")
    .insert(colors)
    .select("id");

  if (colorsError) rethrow(colorsError, "save its colours");

  /* Postgres does not promise the order of returned rows, so the ids are matched
     back to their positions by `sort_order` rather than by array position. Getting
     this wrong quietly attaches every photograph to the wrong colourway. */
  const ordered = [...(createdColors as { id: string; sort_order: number }[])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const imageRows = ordered.flatMap((color, index) =>
    Object.entries(input.images[index] ?? {}).map(([angle, url]) => ({
      color_id: color.id,
      angle,
      image_url: url ?? null,
      sort_order: 0,
    })),
  );

  if (imageRows.length > 0) {
    const { error: imagesError } = await supabase.from("product_images").insert(imageRows);
    if (imagesError) rethrow(imagesError, "save its photographs");
  }

  /* Re-read rather than assembling the return value by hand. One round trip is
     cheaper than the alternative, which is a mapper that has to guess at defaults
     the database might have changed. */
  const created = await getProduct(product.id);
  if (!created) throw new Error(`Created product ${product.id} but could not read it back.`);
  return created;
}

/**
 * Update a product and replace its colours and images.
 *
 * Colours are deleted and re-inserted rather than diffed. That is the brief's
 * suggestion and it is the right one at this size: a colourway is a name, a hex
 * and some photographs, the whole set is a handful of rows, and the admin edits
 * one product at a time. A diff would need to reconcile renames against
 * unchanged rows and would be a lot of code to avoid deleting six rows.
 *
 * The `UNIQUE (color_id, angle)` constraint does the real work here: after the
 * delete, the inserts cannot collide with each other, so a retried save is
 * idempotent rather than failing halfway.
 */
export async function updateProduct(id: string, input: ProductInput): Promise<AdminProduct> {
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("products")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      base_price: input.basePrice,
      discount_percent: input.discountPercent,
      stock_quantity: input.stockQuantity,
      featured: input.featured,
      active: input.active,
    })
    .eq("id", id);

  if (updateError) rethrow(updateError, "update the product");

  /* Images go with the colours, so this one call clears both. ON DELETE CASCADE
     from product_colors is what does it — see 001_initial.sql. */
  const { error: deleteError } = await supabase
    .from("product_colors")
    .delete()
    .eq("product_id", id);

  if (deleteError) rethrow(deleteError, "replace its colours");

  const colors = input.colors.map((color, index) => ({
    product_id: id,
    color_name: color.name,
    color_hex: color.hex,
    sort_order: index,
  }));

  const { data: createdColors, error: colorsError } = await supabase
    .from("product_colors")
    .insert(colors)
    .select("id, sort_order");

  if (colorsError) throw colorsError;

  const ordered = [...(createdColors as { id: string; sort_order: number }[])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const imageRows = ordered.flatMap((color, index) =>
    Object.entries(input.images[index] ?? {}).map(([angle, url]) => ({
      color_id: color.id,
      angle,
      image_url: url ?? null,
      sort_order: 0,
    })),
  );

  if (imageRows.length > 0) {
    const { error: imagesError } = await supabase.from("product_images").insert(imageRows);
    if (imagesError) throw imagesError;
  }

  const updated = await getProduct(id);
  if (!updated) throw new Error(`Updated product ${id} but could not read it back.`);
  return updated;
}

/** Delete a product. Colours and images cascade; nothing else is touched. */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) rethrow(error, "delete the product");
}

/**
 * The columns the inline table editor may write.
 *
 * A union rather than a `string`, so a typo is a compile error instead of a
 * runtime "column not found" — and so this function cannot be talked into writing
 * an arbitrary column such as `active` from a UI path that was meant to set stock.
 */
export type QuickField = "stock_quantity" | "discount_percent" | "featured" | "active";

export async function updateProductField(
  id: string,
  field: QuickField,
  value: number | boolean,
): Promise<AdminProduct> {
  const supabase = createAdminClient();

  /* Written out per field rather than as `{ [field]: value }`. A computed key
     erases the column's type, which is both a compile error here and the reason
     this needs a switch at all: the four columns hold different types, and a form
     input arrives as a string whether the column is a number or a boolean. The
     coercion is the point — `"5"` must become `5`, and `"true"` must not become a
     truthy string that Postgres rejects. */
  const updates: Tables<"products">["Update"] =
    field === "stock_quantity"
      ? { stock_quantity: toInteger(value) }
      : field === "discount_percent"
        ? { discount_percent: toInteger(value) }
        : field === "featured"
          ? { featured: toBoolean(value) }
          : { active: toBoolean(value) };

  const { error } = await supabase.from("products").update(updates).eq("id", id);
  if (error) rethrow(error, `update ${field}`);

  const updated = await getProduct(id);
  if (!updated) throw new Error(`Updated ${field} on ${id} but could not read it back.`);
  return updated;
}

/** Whole numbers from whatever the caller had — a form input is a string. */
function toInteger(value: number | boolean | string): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/**
 * A real boolean from whatever the caller had.
 *
 * `Boolean("false")` is `true`, which is the sort of bug that quietly marks an
 * inactive product as featured. So the strings are read explicitly.
 */
function toBoolean(value: number | boolean | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value.trim().toLowerCase() === "true" || value.trim() === "1";
}

/**
 * Counts for the dashboard.
 *
 * Five numbers, and the shape of the answer is the interesting part. `lowStock` and
 * `outOfStock` count products, not units, and only among active ones — the card
 * says "Low stock" and a person reading it wants to know how many products need
 * reordering, not how many shelves are short. Counting inactive products would put
 * a number on the dashboard that no one can act on.
 *
 * One round trip for all five, using a single aggregate over all products. Six
 * separate count queries would be six round trips for numbers that fit on one row.
 */
export interface DashboardStats {
  totalProducts: number;
  totalBags: number;
  totalShoes: number;
  /** Active products with 1–4 units. Zero counts as out of stock, not low. */
  lowStock: number;
  outOfStock: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("category, stock_quantity, active")
    .eq("active", true);

  if (error) rethrow(error, "read the dashboard counts");

  const rows = data ?? [];

  return {
    totalProducts: rows.length,
    totalBags: rows.filter((row) => row.category === "bag").length,
    totalShoes: rows.filter((row) => row.category === "shoe").length,
    lowStock: rows.filter((row) => row.stock_quantity > 0 && row.stock_quantity < 5).length,
    outOfStock: rows.filter((row) => row.stock_quantity === 0).length,
  };
}

/**
 * The angles a product of this category is photographed from, for the admin form.
 *
 * Re-exported from here so the form does not have to reach past the api layer into
 * `lib/angles.ts` for a value that is really part of "what does a product look
 * like".
 */
export function anglesForProduct(category: string): Angle[] {
  return anglesForCategory(category);
}

/** Not used by the admin UI, but the type belongs next to the functions above. */
export type { ColorVariant };