import type { LegalSection } from "./types";

export const products = {
  id: "products",
  title: "1. Products, descriptions and availability",
  order: 1,
  content: `We aim to display accurate product names, descriptions, photographs, colours, sizes, prices and availability.

- **Footwear:** Please check the listed shoe size and, where possible, the fit before purchasing. Numbered shoe sizes are displayed using the European (EU) sizing system unless a product explicitly states otherwise.
- **Colours:** Actual product colours may vary slightly from website photographs because of lighting, photography and device screen settings.
- **Stock:** An item shown on the website is subject to availability when the order is processed. If an ordered item is unavailable, we will contact you to discuss an appropriate alternative or cancellation and refund.`,
} satisfies LegalSection;
