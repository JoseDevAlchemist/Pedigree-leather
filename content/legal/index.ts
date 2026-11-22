import { products } from "./products";
import { ordersPayments } from "./orders-payments";
import { cancellations } from "./cancellations";
import { delivery } from "./delivery";
import { inspections } from "./inspections";
import { returnsExchanges } from "./returns-exchanges";
import { productCare } from "./product-care";
import { complaints } from "./complaints";
import { privacy } from "./privacy";
import { updates } from "./updates";
import { contact } from "./contact";

export type { LegalSection } from "./types";

export const termsTitle = "Pedigree Leather — Terms of Service, Sales, Returns & Privacy Policy";
export const effectiveDate = "22 November 2026";
export const termsIntroduction = `**Effective date:** 22 November 2026  
**Applicable law:** Laws of Kenya

Welcome to Pedigree Leather. These terms explain how purchases, payments, deliveries, cancellations, product inspections, returns, complaints and personal information are handled when you shop with us online or in-store.

By placing an order or purchasing from us, you agree to these terms, subject to your rights under applicable Kenyan law. Nothing in this document limits or excludes any consumer rights or remedies that cannot legally be limited or excluded.`;
export const termsClosing = "*This document combines our Terms of Service, Sales and Payment Terms, Cancellation Policy, Delivery Policy, Returns & Exchanges Policy, Product Care Guidance, Complaints Policy and Privacy Policy.*";

export const legalSections = [
  products,
  ordersPayments,
  cancellations,
  delivery,
  inspections,
  returnsExchanges,
  productCare,
  complaints,
  privacy,
  updates,
  contact,
] as const;

export const legalPages = {
  terms: { title: termsTitle, label: "Terms", sections: legalSections },
  returns: { title: "Returns and exchanges", label: "Returns", sections: [returnsExchanges] },
  delivery: { title: "Delivery policy", label: "Delivery", sections: [delivery, inspections] },
  cancellation: { title: "Cancellation policy", label: "Cancellation", sections: [cancellations] },
  privacy: { title: "Privacy policy", label: "Privacy", sections: [privacy] },
} as const;

export function getLegalPage(slug: string) {
  return Object.hasOwn(legalPages, slug) ? legalPages[slug as keyof typeof legalPages] : undefined;
}
