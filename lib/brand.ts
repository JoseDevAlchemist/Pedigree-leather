export const BRAND_STATEMENT = "Your reliable supplier of high-quality leather products.";

/** Suppress legacy production claims in customer-facing branding settings. */
export function storefrontBrandCopy(value?: string | null) {
  const productionClaim = /\b(?:hand[\s-]?(?:craft(?:ed|s|ing)?|made|mak(?:e|es|ing)|stitch(?:ed|es|ing)?)|manufactur(?:e|es|ed|er|ers|ing)|(?:craft(?:ed|s|ing)?|made|stitch(?:ed|es|ing)?)\s+in\s+nairobi|(?:our|nairobi)\s+workshop)\b/i;
  return value && !productionClaim.test(value) ? value : undefined;
}
