import { getShopSettings } from "@/lib/settings-api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const settings = await getShopSettings();

    return NextResponse.json({
      shopName: settings.shop_name,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      address: settings.address,
      googleMapsUrl: settings.google_maps_url,
      deliveryFlatRate: settings.delivery_flat_rate,
      freeDeliveryThreshold: settings.free_delivery_threshold,
      pickupAvailable: settings.pickup_available,
    });
  } catch {
    // Fallback to defaults
    return NextResponse.json({
      shopName: "Pedigree Leather",
      phone: "+254143354741",
      whatsapp: "254143354741",
      email: "hello@pedigree.co.ke",
      address: "Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya",
      googleMapsUrl: "#",
      deliveryFlatRate: 300,
      freeDeliveryThreshold: 25000,
      pickupAvailable: true,
    });
  }
}