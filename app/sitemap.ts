import { MetadataRoute } from "next";
import { getProducts } from "@/lib/api";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();

  const productUrls = products.map((product) => ({
    url: `${siteUrl}/${product.category}s/${product.slug}`,
    lastModified: product.createdAt ? new Date(product.createdAt) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const staticUrls = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${siteUrl}/bags`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${siteUrl}/shoes`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ];

  return [...staticUrls, ...productUrls];
}