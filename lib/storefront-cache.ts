export const storefrontCache = {
  catalogue: { table: "products", revalidate: 30, tag: "storefront:catalogue" },
  categories: { table: "categories", revalidate: 60, tag: "storefront:categories" },
  settings: { table: "shop_settings", revalidate: 60, tag: "storefront:settings" },
  legal: { table: "legal_pages", revalidate: 120, tag: "storefront:legal" },
} as const;

export type StorefrontCacheScope = keyof typeof storefrontCache;

export function legalPolicyCacheTag(slug: string) {
  return `${storefrontCache.legal.tag}:${slug}`;
}
