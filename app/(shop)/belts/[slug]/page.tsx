import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/product/ProductDetail";
import { getProductBySlug, getProductSlugs } from "@/lib/api";
import { originalProductImageUrl } from "@/lib/product-image-url";

type ProductPageProps = PageProps<"/belts/[slug]">;

export async function generateStaticParams() {
  const slugs = await getProductSlugs("belt");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "belt");

  if (!product || !product.colors.some((color) => color.stockQuantity > 0)) {
    return { title: "Not found" };
  }

  const firstImage = product.colors[0]?.images?.front;
  const imageUrl = firstImage ? originalProductImageUrl(firstImage) : "/icon.png";

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

export default async function BeltPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug, "belt");

  if (!product || !product.colors.some((color) => color.stockQuantity > 0)) {
    notFound();
  }

  return <ProductDetail product={product} />;
}