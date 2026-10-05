import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/product/ProductDetail";
import { getProductBySlug, getProductSlugs } from "@/lib/api";

type ProductPageProps = PageProps<"/bags/[slug]">;

/**
 * Prerender every bag. Without this the dynamic route could only resolve at
 * request time, and each visit would re-render the server component.
 */
export async function generateStaticParams() {
  const slugs = await getProductSlugs("bag");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "bag");

  if (!product) return { title: "Not found" };

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "bag");

  /* A missing bag is a 404, not a blank page. The api seam returns null for "not
     found" precisely so this can be decided here — and it also returns null for a
     shoe slug, so `/bags/karura-derby` is a 404 rather than a shoe on a bags URL. */
  if (!product) notFound();

  return <ProductDetail product={product} />;
}