import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/product/ProductDetail";
import { getProductBySlug, getProductSlugs } from "@/lib/api";

type ProductPageProps = PageProps<"/shoes/[slug]">;

/**
 * Prerender every shoe.
 *
 * `getProductSlugs("shoe")` rather than all slugs, so this route does not also
 * prerender `/shoes/karura-tote` — a path that would resolve and then 404.
 */
export async function generateStaticParams() {
  const slugs = await getProductSlugs("shoe");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "shoe");

  if (!product) return { title: "Not found" };

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ShoePage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "shoe");

  /* The seam returns null for a bag slug on this route as well as for a slug that
     does not exist, so `/shoes/karura-tote` is a 404 rather than a bag on a shoes
     URL — a page that renders, is crawlable, and is wrong. */
  if (!product) notFound();

  /* The same `ProductDetail` as `/bags/[slug]`. It reads the category off the
     product, so the back link, the cart line and the views all follow without
     being told which route rendered it. */
  return <ProductDetail product={product} />;
}