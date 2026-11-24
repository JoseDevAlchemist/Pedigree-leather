import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getOrderById } from "@/lib/orders-api";
import { getShopSettings } from "@/lib/settings-api";
import { allowsDeferredPayment, isStkConfigured } from "@/lib/payments/config";
import { PaymentClient } from "./PaymentClient";

/**
 * Payment method selection for a freshly created order.
 *
 * A server component so the order is read on the server with the service-role
 * client. The order page does the same thing: guests have no session, so the
 * browser cannot read `orders` directly and a client-side fetch would need a
 * public API route that anyone could enumerate.
 *
 * Anything that makes the page meaningless — a malformed id, an unknown order,
 * an order that is already paid — is resolved here rather than in the client,
 * so the browser never flashes a payment form for an order it must not pay.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

// Payment state changes underneath this page (STK callback, admin marking an
// order paid). It must never be served from the full route cache.
export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  if (!UUID_PATTERN.test(orderId)) {
    notFound();
  }

  const order = await getOrderById(orderId);

  if (!order) {
    notFound();
  }

  // Nothing left to pay. Send them to the confirmation/tracking page instead of
  // showing a form that would overwrite payment_method on a settled order.
  if (order.payment_status === "paid") {
    redirect(`/order/${order.id}`);
  }

  const settings = await getShopSettings().catch(() => null);
  const methods = {
    mpesa: Boolean(settings) && isStkConfigured() && settings?.storefront_preferences.stk_enabled !== false,
    payOnDelivery: !!settings && allowsDeferredPayment(settings.storefront_preferences, order.delivery_method),
  };

  return (
    <PaymentClient
      order={{
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        delivery_method: order.delivery_method,
        delivery_address: order.delivery_address,
        total: order.total,
        payment_status: order.payment_status,
      }}
      availableMethods={methods}
      manualInstructions={settings?.storefront_preferences.manual_payment_instructions}
      confirmationWaitSeconds={settings?.storefront_preferences.stk_wait_seconds}
    />
  );
}
