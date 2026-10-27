import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/supabase/guards";
import { listCategoriesAction } from "@/lib/actions/categories";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "New product",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  await requireAdmin();

  /* Categories for the category select. If the fetch fails the form still works
     — the select is empty and the product can be saved without a category. */
  let categories: Category[] = [];
  try {
    const result = await listCategoriesAction();
    if (result.ok) categories = result.data as Category[];
  } catch {
    /* fall back to empty */
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        New product
      </h2>
      <p className="mt-1 mb-8 text-sm text-muted">
        It appears in the shop as soon as it is saved. Photographs are optional — a
        colour block stands in until one is uploaded.
      </p>

      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
