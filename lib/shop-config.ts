/**
 * Shop configuration — single source of truth for business constants.
 *
 * Everything the checkout, payment and confirmation pages need lives here.
 * When the client provides real credentials, swap the values in this file
 * and the whole flow updates. No hardcoded strings in components.
 *
 * The actual values come from the database (shop_settings table).
 * These constants serve as fallbacks when the DB is unavailable or during build.
 */

export const SHOP = {
  name: "Pedigree Leather",
  phone: "+254143354741",
  whatsapp: "254143354741",
  email: "hello@pedigree.co.ke",
  address: "Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya",
  googleMapsUrl: "#",
} as const;

export const DELIVERY = {
  flatRateNairobi: 300,
  freeDeliveryThreshold: 25000,
  pickupAvailable: true,
} as const;

export interface ShopConfig {
  shopName: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string;
  googleMapsUrl: string | null;
  deliveryFlatRate: number;
  freeDeliveryThreshold: number;
  pickupAvailable: boolean;
}

/**
 * Server-side helper to get shop configuration from the database.
 * Falls back to the constants above if DB is unavailable.
 * Use this in Server Components and server actions instead of importing SHOP/DELIVERY directly.
 */
export async function getShopConfig(): Promise<ShopConfig> {
  try {
    // Dynamic import to avoid circular dependency
    const { getShopSettings } = await import("@/lib/settings-api");
    const settings = await getShopSettings();

    return {
      shopName: settings.shop_name,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      address: settings.address,
      googleMapsUrl: settings.google_maps_url,
      deliveryFlatRate: settings.delivery_flat_rate,
      freeDeliveryThreshold: settings.free_delivery_threshold,
      pickupAvailable: settings.pickup_available,
    };
  } catch {
    // Fallback to constants
    return {
      shopName: SHOP.name,
      phone: SHOP.phone,
      whatsapp: SHOP.whatsapp,
      email: SHOP.email,
      address: SHOP.address,
      googleMapsUrl: SHOP.googleMapsUrl,
      deliveryFlatRate: DELIVERY.flatRateNairobi,
      freeDeliveryThreshold: DELIVERY.freeDeliveryThreshold,
      pickupAvailable: DELIVERY.pickupAvailable,
    };
  }
}