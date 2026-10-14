"use server";

import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { updateShopSettings } from "@/lib/settings-api";
import { revalidatePath } from "next/cache";

const shopInfoSchema = z.object({
  shop_name: z.string().min(1, "Shop name is required"),
  phone: z.string().min(5, "Phone is required"),
  whatsapp: z.string().min(5, "WhatsApp number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().min(5, "Address is required"),
  google_maps_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

const deliverySchema = z.object({
  delivery_flat_rate: z.coerce.number().min(0, "Fee must be positive"),
  free_delivery_threshold: z.coerce.number().min(0, "Threshold must be positive"),
  pickup_available: z.boolean(),
});

export async function updateShopInfoAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole("owner");

    const rawData = {
      shop_name: formData.get("shop_name"),
      phone: formData.get("phone"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email") || "",
      address: formData.get("address"),
      google_maps_url: formData.get("google_maps_url") || "",
    };

    const parsed = shopInfoSchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    await updateShopSettings(parsed.data);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/checkout");

    return { ok: true };
  } catch (error) {
    console.error("[updateShopInfoAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function updateDeliverySettingsAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole("owner");

    const rawData = {
      delivery_flat_rate: formData.get("delivery_flat_rate"),
      free_delivery_threshold: formData.get("free_delivery_threshold"),
      pickup_available: formData.get("pickup_available") === "true",
    };

    const parsed = deliverySchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    await updateShopSettings(parsed.data);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/checkout");

    return { ok: true };
  } catch (error) {
    console.error("[updateDeliverySettingsAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}