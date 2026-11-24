import type { LegalSection } from "./types";

export const ordersPayments = {
  id: "orders-payments",
  title: "2. Orders and payment verification",
  order: 2,
  content: `An order is accepted for processing after its details and availability have been confirmed. Payment methods available at checkout are those currently offered by Pedigree Leather.

An order is marked as **paid** only after payment has been verified through the relevant authorized payment channel. A customer-facing payment message or screenshot alone does not establish receipt of funds. We will contact you if a payment requires clarification.`,
} satisfies LegalSection;
