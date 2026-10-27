"use server";

/**
 * Server actions for category CRUD.
 *
 * Guarded with `requireRole("owner")` — only the shop owner can create, update,
 * reorder or delete categories. Writes go through `lib/categories-api.ts`, which
 * uses the service-role client.
 */

import { revalidatePath } from "next/cache";

import {
  createCategory as createCategoryRow,
  deleteCategory as deleteCategoryRow,
  reorderCategories as reorderCategoriesRow,
  updateCategory as updateCategoryRow,
} from "@/lib/categories-api";
import { requireAdminRole } from "@/lib/supabase/guards";
import { categorySchema, firstError } from "@/lib/validation";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

async function guarded<T>(
  what: string,
  run: () => Promise<T>,
  requiredRole: "owner" | "worker" = "owner",
): Promise<ActionResult<T>> {
  try {
    await requireAdminRole(requiredRole);
    return { ok: true, data: await run() };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createCategory", async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      const { message } = firstError(parsed.error);
      throw new Error(message);
    }

    const created = await createCategoryRow({
      name: parsed.data.name,
      slug: parsed.data.slug,
      parentId: parsed.data.parentId ?? null,
      displayOrder: parsed.data.displayOrder,
      isActive: parsed.data.isActive,
    });

    if (!created.ok) throw new Error(created.error);

    revalidatePath("/admin/categories", "layout");
    revalidatePath("/", "layout");
    revalidatePath("/category/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return { id: created.category.id };
  });
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("updateCategory", async () => {
    if (!id) throw new Error("No category was named to update.");

    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      const { message } = firstError(parsed.error);
      throw new Error(message);
    }

    const updated = await updateCategoryRow(id, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      parentId: parsed.data.parentId,
      displayOrder: parsed.data.displayOrder,
      isActive: parsed.data.isActive,
    });

    if (!updated.ok) throw new Error(updated.error);

    revalidatePath("/admin/categories", "layout");
    revalidatePath("/", "layout");
    revalidatePath("/category/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return { id };
  });
}

export async function deleteCategoryAction(
  id: string,
): Promise<ActionResult<null>> {
  return guarded("deleteCategory", async () => {
    if (!id) throw new Error("No category was named to delete.");

    const deleted = await deleteCategoryRow(id);
    if (!deleted.ok) throw new Error(deleted.error);

    revalidatePath("/admin/categories", "layout");
    revalidatePath("/", "layout");
    revalidatePath("/category/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return null;
  });
}

export async function reorderCategoriesAction(
  ids: string[],
): Promise<ActionResult<null>> {
  return guarded("reorderCategories", async () => {
    const reordered = await reorderCategoriesRow(ids);
    if (!reordered.ok) throw new Error(reordered.error);

    revalidatePath("/admin/categories", "layout");
    revalidatePath("/", "layout");
    revalidatePath("/category/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return null;
  });
}

/**
 * Categories for the product form's select. A worker can edit products, so this
 * read must not require the owner role — only category *writes* are owner-only.
 */
export async function listCategoriesAction(): Promise<ActionResult<unknown[]>> {
  return guarded(
    "listCategories",
    async () => {
      const { getCategories } = await import("@/lib/categories-api");
      const categories = await getCategories();
      return categories;
    },
    "worker",
  );
}

/**
 * The admin's full list, including inactive categories. The public
 * `getCategories()` deliberately reads through RLS and only returns active rows,
 * which is wrong for a screen whose job is to reactivate one.
 */
export async function listAllCategoriesAction(): Promise<ActionResult<unknown[]>> {
  return guarded("listAllCategories", async () => {
    const { getAllCategories } = await import("@/lib/categories-api");
    const categories = await getAllCategories();
    return categories;
  });
}
