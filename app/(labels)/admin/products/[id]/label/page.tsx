import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductLabel } from "@/components/pos/product-label";
import { getProduct } from "@/lib/admin-api";
import { effectivePrice, formatPrice } from "@/lib/format";
import { requireAdminUser } from "@/lib/supabase/guards";

export const metadata: Metadata = {
  title: "Print product label",
  robots: { index: false, follow: false },
};

export default async function ProductLabelPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]/label">) {
  await requireAdminUser();

  const [{ id }, { colour }] = await Promise.all([params, searchParams]);
  const product = await getProduct(id);
  const variant = product?.colors.find((entry) => entry.id === colour);

  if (!product?.barcode?.trim() || !variant) notFound();

  return (
    <ProductLabel
      code={product.barcode.trim()}
      name={product.name}
      colour={variant.name}
      price={formatPrice(effectivePrice(product.basePrice, product.discountPercent))}
    />
  );
}
