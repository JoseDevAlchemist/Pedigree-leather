import { getShopConfig } from "@/lib/shop-config";
import { NextResponse } from "next/server";

const freshResponse = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const config = await getShopConfig({ strict: true });
    return NextResponse.json({
      address: config.address,
      deliveryEnabled: config.deliveryEnabled,
      deliveryFlatRate: config.deliveryFlatRate,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      pickupAvailable: config.pickupAvailable,
      pickupAddress: config.pickupAddress,
      pickupHours: config.pickupHours,
      pickupInstructions: config.pickupInstructions,
      deliveryEstimate: config.deliveryEstimate,
      preparationTime: config.preparationTime,
      checkoutInstructions: config.checkoutInstructions,
      taxDisplayNote: config.taxDisplayNote,
    }, freshResponse);
  } catch {
    return NextResponse.json({ error: "Checkout configuration is unavailable." }, { ...freshResponse, status: 503 });
  }
}
