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

  if (!product || !product.colors.some((color) => color.stockQuantity > 0)) {
    return { title: "Not found" };
  }

  const firstImage = product.colors[0]?.images?.front;
  const imageUrl = firstImage ? `https://${new URL(firstImage).host}${firstImage}` : "/icon.png";

  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.description.slice(0, 160),
      images: [imageUrl],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "bag");

  /* A missing bag is a 404, not a blank page. The api seam returns null for "not
     found" precisely so this can be decided here — and it also returns null for a
     shoe slug, so `/bags/karura-derby` is a 404 rather than a shoe on a bags URL.
     A product whose every colour is sold out is treated the same way: the shop
     does not list it, so its detail URL must not resurrect it. */
  if (!product || !product.colors.some((color) => color.stockQuantity > 0)) {
    notFound();
  }

  return <ProductDetail product={product} />;
}