"use server";

/**
 * Server actions for payment initiation.
 *
 * The payment page is public (guest checkout). These actions validate input,
 * call the payment provider, and persist the result on the order. Callers get
 * a typed `{ ok, data }` or `{ ok, error }`.
 */

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { markPaymentMethodAction } from "@/lib/actions/orders";
import { initiateStkPush, normalizeMpesaPhone } from "@/lib/payments/mpesa";
import { isValidKenyanPhone } from "@/lib/payment-utils";

const startMpesaSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  phone: z.string().refine((val) => isValidKenyanPhone(val), {
    message: "Enter a valid Kenyan phone number (+254..., 07..., or 01...)",
  }),
});

export async function startMpesaPaymentAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = startMpesaSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        error: issue ? issue.message : "Invalid request.",
      };
    }

    const { orderId, phone } = parsed.data;
    const normalizedPhone = normalizeMpesaPhone(phone);

    /* Look up the order total and number so Daraja gets a short, meaningful
       account reference. The client never supplies the amount. */
    const supabase = createAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("total, payment_status, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { ok: false, error: "Order not found." };
    }

    if (order.payment_status === "paid") {
      return { ok: false, error: "This order has already been paid." };
    }

    const result = await initiateStkPush({
      phone: normalizedPhone,
      amount: order.total,
      /* Keep within Daraja's 12-character AccountReference limit. The callback
         does not depend on this string; it uses CheckoutRequestID. */
      accountReference: order.order_number.replace(/^PED-/, ""),
      description: `Order ${order.order_number.slice(-4)}`,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    /* Persist the CheckoutRequestID before the callback can arrive. Without
       this, two simultaneous customers would be indistinguishable. */
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "pending",
        payment_method: "mpesa",
        checkout_request_id: result.checkoutRequestId,
        /* If the shopper previously submitted a manual Till code and is now
           retrying with STK, the old claim is no longer the payment path. The
           callback will write the real M-Pesa receipt here. */
        payment_reference: null,
        paid_at: null,
      })
      .eq("id", orderId);

    if (error) {
      console.error(`[payments] startMpesa:${orderId}:`, error);
      return {
        ok: false,
        error:
          "The M-Pesa prompt was sent, but we could not record it. Please contact us before paying.",
      };
    }

    /* Do not return the CheckoutRequestID to the browser. The callback trusts
       the ID, so keeping it server-side prevents a customer from forging a
       success callback for their own order. */
    return { ok: true };
  } catch (error) {
    console.error("[payments] startMpesaPaymentAction:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Payment failed.",
    };
  }
}

/* Kept for the future real Flutterwave flow. The current card card is a
   deliberate demo and uses `completeCardPlaceholderAction` instead. */
export async function startCardPaymentAction(
  orderId: string,
): Promise<
  | { ok: true; txRef: string }
  | { ok: false; error: string }
> {
  /* Flutterwave v3 inline checkout is initiated client-side (the script opens
     the checkout overlay). The server action only returns a tx_ref derived
     from the order id, which the client passes to Flutterwave. */
  const txRef = `PED-${orderId}`;
  return { ok: true, txRef: txRef };
}

const manualMpesaSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  code: z
    .string()
    .trim()
    .min(8, "Enter the 8–12 character M-Pesa confirmation code.")
    .max(12, "Enter the 8–12 character M-Pesa confirmation code.")
    .regex(
      /^[A-Z0-9]+$/i,
      "The confirmation code contains letters and numbers only.",
    ),
});

/**
 * Manual "Lipa na M-Pesa" fallback.
 *
 * The code is proof the shopper claims to have paid, not proof the payment
 * settled. Save it as `payment_reference` and leave `payment_status` pending so
 * the owner can verify it against the M-Pesa statement before fulfilment.
 */
export async function submitManualMpesaAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = manualMpesaSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Enter the M-Pesa confirmation code.",
    };
  }

  const result = await markPaymentMethodAction(
    parsed.data.orderId,
    "mpesa_manual",
    { reference: parsed.data.code.toUpperCase() },
  );

  return result.ok
    ? { ok: true }
    : {
        ok: false,
        error:
          result.error ?? "Could not save the M-Pesa confirmation code.",
      };
}

/**
 * TEMPORARY: the card provider keys are not configured yet.
 *
 * The client waits a moment, tells the shopper card integration is coming, and
 * then calls this so test orders do not remain stuck in pending. Remove this
 * alongside the demo card form when Flutterwave is live.
 */
export async function completeCardPlaceholderAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid("Invalid order").safeParse(orderId);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order.",
    };
  }

  const result = await markPaymentMethodAction(parsed.data, "card", {
    markPaid: true,
    reference: `CARD-DEMO-${Date.now()}`,
  });

  return result.ok
    ? { ok: true }
    : {
        ok: false,
        error: result.error ?? "Could not record the demo payment.",
      };
}
