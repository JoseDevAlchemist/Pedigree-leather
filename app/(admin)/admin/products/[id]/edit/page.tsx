import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/ProductForm";
import { getProduct } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/supabase/guards";

type PagePropsForEdit = PageProps<"/admin/products/[id]/edit">;

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

/**
 * Edit an existing product.
 *
 * `notFound()` for a missing id rather than an error page: the id in the URL is a
 * database id, so a stale one is a link that has gone out of date, and the shop's own
 * 404 is the right answer for that. It also stops this page rendering an empty form
 * whose "Save" would then create a *second* product instead of editing the first —
 * the failure mode of treating "not found" as "new".
 */
export default async function EditProductPage({ params }: PagePropsForEdit) {
  await requireAdmin();

  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        {product.name}
      </h2>
      <p className="mt-1 mb-8 text-sm text-muted">
        Last added {new Date(product.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {product.active ? "" : " · hidden from the shop"}
      </p>

      <ProductForm mode="edit" initialData={product} />
    </div>
  );
}