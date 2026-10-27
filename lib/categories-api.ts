/**
 * Category reads and writes.
 *
 * Public reads go through `lib/supabase/public.ts` (anon key, RLS: active only)
 * and are cached with React's `cache()` so a layout and a page sharing the same
 * request hit the database once. Writes go through `lib/supabase/admin.ts`
 * (service role) and are called only from Server Actions.
 */

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category } from "@/lib/types";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}

/**
 * A public client, or `null` when the environment is incomplete.
 *
 * A fresh deployment can be built before its Supabase variables exist. The
 * queries below already treat a missing/empty table as "no categories"; this
 * makes the same true of a missing client, so the shop shell and the category
 * route can render their empty state instead of failing the build.
 */
function publicClientOrNull(label: string) {
  try {
    return createPublicClient();
  } catch (error) {
    console.error(`[pedigree/categories] ${label}:`, error);
    return null;
  }
}

function adminClientOrNull(label: string) {
  try {
    return createAdminClient();
  } catch (error) {
    console.error(`[pedigree/categories] ${label}:`, error);
    return null;
  }
}

/**
 * Every active category, flattened in display order.
 *
 * Deliberately flat rather than nested: three different consumers want the same
 * rows sliced differently. The navbar builds its dropdowns by filtering
 * `parentId`, the product form groups them into `<optgroup>`s, and the sitemap
 * wants every slug — including children. Returning a tree would force each of
 * them to flatten it again, and two of the three would inevitably disagree.
 *
 * Cached per request with `cache()`, so the shop layout and a page that both
 * need categories still hit the database once.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = publicClientOrNull("getCategories");
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[pedigree/categories] getCategories:", error);
    return [];
  }

  return ((data ?? []) as CategoryRow[]).map(toCategory);
});

/**
 * Top-level categories only (`parent_id IS NULL`), in display order.
 *
 * Used where a parent is the only sensible choice — picking a parent for a new
 * category, for example. The shop itself needs the full list to build dropdowns,
 * so this is not simply "the navbar's categories".
 */
export const getParentCategories = cache(async (): Promise<Category[]> => {
  const supabase = publicClientOrNull("getParentCategories");
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[pedigree/categories] getParentCategories:", error);
    return [];
  }

  return ((data ?? []) as CategoryRow[]).map(toCategory);
});

/**
 * A single active category by slug, or `null`.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = publicClientOrNull(`getCategoryBySlug:${slug}`);
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[pedigree/categories] getCategoryBySlug:${slug}:`, error);
    return null;
  }

  if (!data) return null;
  return toCategory(data as CategoryRow);
}

/* ---------------------------------------------------------------------------
   Admin helpers — service role. Called only from Server Actions.
   --------------------------------------------------------------------------- */

/**
 * Every category, active and inactive.
 *
 * The shop must never see an inactive row, so this is not `getCategories` with a
 * flag: it uses the service role and exists only for the admin's category list.
 * Without it, deactivating a category would remove it from the very screen used
 * to switch it back on.
 */
export const getAllCategories = cache(async (): Promise<Category[]> => {
  const supabase = adminClientOrNull("getAllCategories");
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[pedigree/categories] getAllCategories:", error);
    return [];
  }

  return ((data ?? []) as CategoryRow[]).map(toCategory);
});

export async function createCategory(input: {
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId,
      display_order: input.displayOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("[pedigree/categories] createCategory:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, category: toCategory(data as CategoryRow) };
}

export async function updateCategory(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    parentId: string | null;
    displayOrder: number;
    isActive: boolean;
  }>,
): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const updates: Partial<{
    name: string;
    slug: string;
    parent_id: string | null;
    display_order: number;
    is_active: boolean;
  }> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.parentId !== undefined) updates.parent_id = input.parentId;
  if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`[pedigree/categories] updateCategory:${id}:`, error);
    return { ok: false, error: error.message };
  }

  return { ok: true, category: toCategory(data as CategoryRow) };
}

export async function deleteCategory(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  /* Check for products referencing this category before deleting. */
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (products && products.length > 0) {
    return {
      ok: false,
      error:
        "Cannot delete this category: products are still assigned to it. Move those products to another category first, or set their category to none.",
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    console.error(`[pedigree/categories] deleteCategory:${id}:`, error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function reorderCategories(
  ids: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  /* Update each row's display_order in its own call — simple and correct. */
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("categories")
        .update({ display_order: index })
        .eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("[pedigree/categories] reorderCategories:", failed.error);
    return { ok: false, error: failed.error.message };
  }

  return { ok: true };
}
