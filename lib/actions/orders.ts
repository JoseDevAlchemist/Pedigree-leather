"use server";

/**
 * Server actions for order operations.
 *
 * These are the only way components interact with orders — they validate
 * input, call the server-only API, and return serializable results.
 */

import { z } from "zod";
import { createOrder, getOrderById } from "@/lib/orders-api";
import { getActiveDeliveryZone } from "@/lib/settings-api";
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

const paymentMethodSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  method: z.enum(["mpesa", "mpesa_manual", "card", "pay_on_delivery"]),
  reference: z.string().trim().max(80).optional(),
  markPaid: z.boolean().optional(),
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
    let zoneName = delivery.zoneName || null;
    /* `kenyanPhoneSchema` has already transformed this to +254... — see
       `lib/validation.ts`. Keep one canonical value for the order and the
       WhatsApp messages rather than normalising twice. */
    const normalizedPhone = customer.phone;

    if (delivery.method === "delivery") {
      const address = delivery.address?.trim() || "";
      if (!address || address.length < 10) {
        return { ok: false, error: "Please enter a delivery address (at least 10 characters)" };
      }
      if (subtotal >= shopConfig.freeDeliveryThreshold) {
        deliveryFee = 0;
      } else if (delivery.zoneId) {
        // The client sends the chosen zone, never the fee. Reading the fee
        // from the database is what stops a crafted request from shipping to
        // Karen for KES 0.
        const zone = await getActiveDeliveryZone(delivery.zoneId);
        if (!zone) {
          return {
            ok: false,
            error: "That delivery zone is no longer available. Please choose another.",
          };
        }
        deliveryFee = zone.fee;
        zoneName = zone.name;
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
      zoneName: zoneName,
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
  method: PaymentMethodValue,
  options: { reference?: string; markPaid?: boolean } = {},
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

    const { reference, markPaid } = parsed.data;
    const supabase = (await import("@/lib/supabase/admin")).createAdminClient();

    /* Read first so a public guest action cannot regress an already-paid order
       or mark an unknown id as paid. */
    const { data: currentOrder, error: orderError } = await supabase
      .from("orders")
      .select("status, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !currentOrder) {
      return { ok: false, error: "Order not found." };
    }

    if (currentOrder.payment_status === "paid") {
      return { ok: false, error: "This order has already been paid." };
    }

    if (currentOrder.status === "cancelled") {
      return { ok: false, error: "This order has been cancelled." };
    }

    const update: {
      payment_method: PaymentMethodValue;
      checkout_request_id: null;
      payment_reference?: string | null;
      payment_status?: "pending" | "paid";
      paid_at?: string | null;
      status?: string;
    } = {
      payment_method: method,
      /* A customer choosing Till or card is abandoning any in-flight STK
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
    } else if (method === "card" && markPaid) {
      /* TEMPORARY demo path until real card keys are configured. The client
         still validates the form; this only persists the outcome so the test
         order does not stay stuck in pending. */
      update.payment_reference =
        reference?.toUpperCase() || `CARD-DEMO-${Date.now()}`;
      update.payment_status = "paid";
      update.paid_at = new Date().toISOString();
      update.status =
        currentOrder.status === "pending_payment"
          ? "paid"
          : currentOrder.status;
    } else if (method === "pay_on_delivery") {
      update.payment_status = "pending";
      update.payment_reference = null;
      update.paid_at = null;
    }

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (
      method === "card" &&
      markPaid &&
      currentOrder.status === "pending_payment"
    ) {
      const { error: historyError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: orderId,
          from_status: currentOrder.status,
          to_status: "paid",
          changed_by_email: null,
          note: "Card demo payment recorded.",
        });

      if (historyError) {
        /* The payment is already saved. A missing audit row should not turn a
           successful demo checkout into an error. */
        console.error(
          "[markPaymentMethodAction] history insert failed:",
          historyError,
        );
      }
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