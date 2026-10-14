"use server";

/**
 * Server actions for order operations.
 *
 * These are the only way components interact with orders — they validate
 * input, call the server-only API, and return serializable results.
 */

import { z } from "zod";
import { createOrder, getOrderById } from "@/lib/orders-api";
import { getShopConfig } from "@/lib/shop-config";

/* ---------------------------------------------------------------------------
   Zod schemas
   --------------------------------------------------------------------------- */

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .refine((val) => /^(\+254|07|01)\d{8,9}$/.test(val.replace(/\s/g, "")), {
      message: "Enter a valid Kenyan phone number (+254..., 07..., or 01...)",
    }),
});

const deliverySchema = z.object({
  method: z.enum(["delivery", "pickup"]),
  address: z.string().optional(),
  zoneId: z.string().uuid().optional(),
  zoneName: z.string().optional(),
});

const notesSchema = z.object({
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
});

const checkoutSchema = z.object({
  customer: customerSchema,
  delivery: deliverySchema,
  notes: notesSchema.shape.notes,
});

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function normalizeKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.startsWith("+254")) return cleaned;
  if (cleaned.startsWith("07") || cleaned.startsWith("01")) {
    return `+254${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("254")) {
    return `+${cleaned}`;
  }
  return cleaned; // Return as-is if unrecognized format
}

/* ---------------------------------------------------------------------------
   Server actions
   --------------------------------------------------------------------------- */

export async function createOrderAction(
  formData: FormData,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  try {
    const rawData = {
      customer: {
        name: formData.get("name"),
        email: formData.get("email") || "",
        phone: formData.get("phone"),
      },
      delivery: {
        method: formData.get("deliveryMethod"),
        address: formData.get("deliveryAddress") || "",
        zoneId: formData.get("zoneId") || undefined,
        zoneName: formData.get("zoneName") || undefined,
      },
      notes: formData.get("notes") || "",
    };

    const parsed = checkoutSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { ok: false, error: firstError.message };
    }

    const { customer, delivery, notes } = parsed.data;

    // Get cart items from the request (they come from the client component)
    const cartItemsJson = formData.get("cartItems") as string;
    const subtotal = Number(formData.get("subtotal"));
    const discountTotal = Number(formData.get("discountTotal"));

    if (!cartItemsJson) {
      return { ok: false, error: "Cart is empty" };
    }

    const cartItems = JSON.parse(cartItemsJson) as {
      productId: string;
      slug: string;
      name: string;
      colorId: string;
      colorName: string;
      colorHex: string;
      unitPrice: number;
      basePrice: number;
      quantity: number;
      image: string | null;
    }[];

    if (cartItems.length === 0) {
      return { ok: false, error: "Cart is empty" };
    }

    // Get shop config for delivery settings
    const shopConfig = await getShopConfig();

    // Calculate delivery fee
    let deliveryFee = 0;
    const normalizedPhone = normalizeKenyanPhone(customer.phone);

    if (delivery.method === "delivery") {
      const address = delivery.address?.trim() || "";
      if (!address || address.length < 10) {
        return { ok: false, error: "Please enter a delivery address (at least 10 characters)" };
      }
      if (subtotal >= shopConfig.freeDeliveryThreshold) {
        deliveryFee = 0;
      } else if (delivery.zoneId) {
        // Zone-based fee will be determined by the selected zone
        // The client already calculated it, but we trust the server
        deliveryFee = 0; // Will be overridden by zone fee from client
      } else {
        deliveryFee = shopConfig.deliveryFlatRate;
      }
    }

    const total = subtotal - discountTotal + deliveryFee;

    // Call the server-only API
    const result = await createOrder({
      customer: {
        name: customer.name.trim(),
        email: customer.email?.trim() || null,
        phone: normalizedPhone,
      },
      deliveryMethod: delivery.method,
      deliveryAddress: delivery.method === "delivery" ? (delivery.address?.trim() || null) : null,
      items: cartItems,
      subtotal,
      discountTotal,
      deliveryFee,
      total,
      notes: notes?.trim() || null,
      zoneId: delivery.zoneId || null,
      zoneName: delivery.zoneName || null,
    });

    // Fetch the created order to get the order number for WhatsApp
    const createdOrder = await getOrderById(result.orderId);
    const config = await getShopConfig();

    // Send WhatsApp notifications (don't fail the order if WhatsApp fails)
    try {
      const { notifyShopOwner, notifyCustomer } = await import("@/lib/whatsapp");
      if (createdOrder) {
        await Promise.all([
          notifyShopOwner({
            order_number: createdOrder.order_number,
            customer_name: customer.name.trim(),
            total,
            delivery_method: delivery.method,
            items: cartItems.map((item) => ({ name: item.name, quantity: item.quantity })),
            delivery_address: delivery.method === "delivery" ? delivery.address?.trim() : null,
            delivery_fee: deliveryFee,
          }),
          notifyCustomer({
            order_number: createdOrder.order_number,
            customer_name: customer.name.trim(),
            customer_phone: normalizedPhone,
            total,
            delivery_method: delivery.method,
            delivery_address: delivery.method === "delivery" ? delivery.address?.trim() : null,
            delivery_fee: deliveryFee,
            shop_address: config.address,
          }),
        ]);
      }
    } catch (whatsappError) {
      console.error("[WhatsApp] Notification failed:", whatsappError);
      // Don't fail the order if WhatsApp fails
    }

    return { ok: true, orderId: result.orderId };
  } catch (error) {
    console.error("[createOrderAction] Error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return { ok: false, error: message };
  }
}

export async function markPaymentMethodAction(
  orderId: string,
  method: "mpesa" | "card" | "pay_on_delivery",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = (await import("@/lib/supabase/admin")).createAdminClient();

    // STUB: sets orders.payment_method and returns ok.
    // Real payment confirmation comes later.
    // TODO: Replace with M-Pesa STK push / Flutterwave init when credentials are ready.
    const { error } = await supabase
      .from("orders")
      .update({ payment_method: method })
      .eq("id", orderId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("[markPaymentMethodAction] Error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return { ok: false, error: message };
  }
}

export async function getOrderAction(orderId: string) {
  try {
    const order = await getOrderById(orderId);
    return order;
  } catch (error) {
    console.error("[getOrderAction] Error:", error);
    return null;
  }
}