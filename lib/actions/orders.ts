"use server";

/**
 * Server actions for order operations.
 *
 * These are the only way components interact with orders — they validate
 * input, call the server-only API, and return serializable results.
 */

import { updateTag } from "next/cache";
import { storefrontCache } from "@/lib/storefront-cache";
import { z } from "zod";
import { createOrder, getOrderById } from "@/lib/orders-api";
import { allowsDeferredPayment } from "@/lib/payments/config";
import { getActiveDeliveryZone, getShopSettings, hasActiveDeliveryZones } from "@/lib/settings-api";
import { getShopConfig } from "@/lib/shop-config";
import { kenyanPhoneSchema } from "@/lib/validation";

/* ---------------------------------------------------------------------------
   Zod schemas
   --------------------------------------------------------------------------- */

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: kenyanPhoneSchema,
});

const deliverySchema = z.object({
  method: z.enum(["delivery", "pickup"]),
  address: z.string().optional(),
  zoneId: z.string().uuid().optional(),
});

const notesSchema = z.object({
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
});

const checkoutSchema = z.object({
  customer: customerSchema,
  delivery: deliverySchema,
  notes: notesSchema.shape.notes,
});

const paymentMethodSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  method: z.enum(["mpesa_manual", "pay_on_delivery"]),
  reference: z.string().trim().max(80).optional(),
});

type PaymentMethodValue = z.infer<typeof paymentMethodSchema>["method"];

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
      },
      notes: formData.get("notes") || "",
    };

    const parsed = checkoutSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { ok: false, error: firstError.message };
    }

    const { customer, delivery, notes } = parsed.data;

    const requestId = z.uuid().parse(formData.get("requestId"));
    const lines = z.array(z.object({
      productId: z.uuid(),
      colorId: z.uuid(),
      sizeId: z.uuid().optional(),
      unitPrice: z.number().int().min(0).max(10_000_000),
      quantity: z.number().int().min(1).max(10),
    })).min(1).max(100);
    const cartItems = lines.parse(JSON.parse(String(formData.get("cartItems"))));
    // The RPC checks every quoted unit price against the locked catalogue.
    const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const shopConfig = await getShopConfig({ strict: true });
    let deliveryFee = 0;
    let zoneName: string | null = null;
    let zoneId: string | null = null;
    const normalizedPhone = customer.phone;

    if (delivery.method === "pickup" && !shopConfig.pickupAvailable) {
      return { ok: false, error: "Store pickup is currently unavailable. Choose another fulfilment method." };
    }

    if (delivery.method === "delivery") {
      if (!shopConfig.deliveryEnabled) {
        return { ok: false, error: "Delivery is currently unavailable. Choose another fulfilment method." };
      }
      if ((delivery.address?.trim().length ?? 0) < 10) {
        return { ok: false, error: "Please enter a delivery address (at least 10 characters)" };
      }

      let fee = shopConfig.deliveryFlatRate;
      if (delivery.zoneId) {
        const zone = await getActiveDeliveryZone(delivery.zoneId);
        if (!zone) {
          return { ok: false, error: "That delivery zone is no longer available. Please choose another." };
        }
        fee = zone.fee;
        zoneId = zone.id;
        zoneName = zone.name;
      } else if (await hasActiveDeliveryZones()) {
        return { ok: false, error: "Please select an available delivery zone." };
      }
      deliveryFee = subtotal >= shopConfig.freeDeliveryThreshold ? 0 : fee;
    }

    const total = subtotal + deliveryFee;

    // Call the server-only API
    const result = await createOrder({
      requestId,
      customer: {
        name: customer.name.trim(),
        email: customer.email?.trim() || null,
        phone: normalizedPhone,
      },
      deliveryMethod: delivery.method,
      deliveryAddress: delivery.method === "delivery" ? (delivery.address?.trim() || null) : null,
      items: cartItems,
      subtotal,
      deliveryFee,
      notes: notes?.trim() || null,
      zoneId,
      zoneName,
    });

    if (!result.created) return { ok: true, orderId: result.orderId };
    updateTag(storefrontCache.catalogue.tag);

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
            items: createdOrder.items.map((item) => ({
              name: [item.product_name, [item.size_system, item.size_label].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
              quantity: item.quantity,
            })),
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
            shop_address: config.pickupAddress || config.address,
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
  method: PaymentMethodValue,
  options: { reference?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = paymentMethodSchema.safeParse({
      orderId,
      method,
      ...options,
    });

    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Invalid payment details.",
      };
    }

    const { reference } = parsed.data;
    const supabase = (await import("@/lib/supabase/admin")).createAdminClient();

    /* Read first so a public guest action cannot regress an already-paid order
       or mark an unknown id as paid. */
    const { data: currentOrder, error: orderError } = await supabase
      .from("orders")
      .select("status, payment_status, delivery_method")
      .eq("id", orderId)
      .single();

    if (orderError || !currentOrder) {
      return { ok: false, error: "Order not found." };
    }

    if (currentOrder.payment_status === "paid" || currentOrder.payment_status === "refunded") {
      return { ok: false, error: "This order has already been paid." };
    }

    if (currentOrder.status === "cancelled") {
      return { ok: false, error: "This order has been cancelled." };
    }

    if (method === "pay_on_delivery") {
      const preferences = (await getShopSettings()).storefront_preferences;
      if (!allowsDeferredPayment(preferences, currentOrder.delivery_method)) {
        return { ok: false, error: "Payment at collection or delivery is unavailable for this order." };
      }
    }

    const update: {
      payment_method: PaymentMethodValue;
      checkout_request_id: null;
      payment_reference?: string | null;
      payment_status?: "pending";
      paid_at?: string | null;
    } = {
      payment_method: method,
      /* A customer choosing Till or pay on delivery is abandoning any in-flight STK
         request. Clearing this prevents a late Safaricom callback from
         settling an order they no longer intend to pay by STK. */
      checkout_request_id: null,
    };

    if (method === "mpesa_manual") {
      const code = reference?.toUpperCase();

      if (!code || !/^[A-Z0-9]{8,12}$/.test(code)) {
        return {
          ok: false,
          error:
            "Enter the 8–12 character M-Pesa confirmation code from the SMS.",
        };
      }

      update.payment_reference = code;
      update.payment_status = "pending";
      update.paid_at = null;
    } else if (method === "pay_on_delivery") {
      update.payment_status = "pending";
      update.payment_reference = null;
      update.paid_at = null;
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .neq("status", "cancelled")
      .eq("payment_status", currentOrder.payment_status)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!updated) return { ok: false, error: "The order changed. Reload before selecting a payment method." };

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