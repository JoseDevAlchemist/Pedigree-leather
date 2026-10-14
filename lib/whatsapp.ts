/**
 * WhatsApp notifications using Twilio.
 *
 * TODO: When TWILIO_* env vars are missing, log to console and return ok:true
 * so dev flow isn't blocked. In production, fail loudly.
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const shopWhatsAppNumber = process.env.SHOP_WHATSAPP_NUMBER || "254791004004";

const isConfigured = accountSid && authToken;

let client: twilio.Twilio | null = null;
if (isConfigured) {
  client = twilio(accountSid, authToken);
}

/**
 * Format a Kenyan phone number for WhatsApp.
 * Input: +2547XX..., 07XX..., 2547XX...
 * Output: whatsapp:+2547XXXXXXXXX
 */
function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  let normalized: string;

  if (cleaned.startsWith("+254")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("07") || cleaned.startsWith("01")) {
    normalized = `+254${cleaned.slice(1)}`;
  } else if (cleaned.startsWith("254")) {
    normalized = `+${cleaned}`;
  } else {
    normalized = `+254${cleaned}`;
  }

  return `whatsapp:${normalized}`;
}

/**
 * Send a WhatsApp message via Twilio.
 * If Twilio is not configured, logs to console and returns ok:true (dev mode).
 */
export async function sendWhatsApp(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const formattedTo = formatWhatsAppNumber(to);

  if (!isConfigured || !client) {
    // Dev mode: log to console instead of sending
    console.log("[WhatsApp DEV MODE] Would send to:", formattedTo);
    console.log("[WhatsApp DEV MODE] Message:", body);
    return { ok: true };
  }

  try {
    await client.messages.create({
      from: fromNumber,
      to: formattedTo,
      body,
    });
    return { ok: true };
  } catch (error) {
    console.error("[WhatsApp] Send failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send WhatsApp" };
  }
}

/**
 * Notify shop owner of a new order.
 */
export async function notifyShopOwner(order: {
  order_number: string;
  customer_name: string;
  total: number;
  delivery_method: "delivery" | "pickup";
  items: { name: string; quantity: number }[];
  delivery_address?: string | null;
  delivery_fee?: number;
}): Promise<void> {
  const itemsSummary = order.items
    .map((item) => `${item.name} ×${item.quantity}`)
    .join(", ");

  const body = [
    `New order ${order.order_number}`,
    `Customer: ${order.customer_name}`,
    `Total: KES ${order.total.toLocaleString("en-KE")}`,
    `Method: ${order.delivery_method === "delivery" ? "Delivery" : "Pickup"}`,
    order.delivery_address ? `Address: ${order.delivery_address}` : "",
    order.delivery_fee && order.delivery_fee > 0 ? `Delivery fee: KES ${order.delivery_fee}` : "",
    `Items: ${itemsSummary}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendWhatsApp(shopWhatsAppNumber, body);
}

/**
 * Notify customer that their order was received.
 */
export async function notifyCustomer(order: {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  delivery_method: "delivery" | "pickup";
  delivery_address?: string | null;
  delivery_fee?: number;
  shop_address?: string;
}): Promise<void> {
  const isDelivery = order.delivery_method === "delivery";

  const body = [
    `Hi ${order.customer_name},`,
    `Your Pedigree Leather order ${order.order_number} has been received.`,
    `Total: KES ${order.total.toLocaleString("en-KE")}.`,
    `We'll WhatsApp you when it's ready.`,
    "",
    isDelivery
      ? `Delivery to: ${order.delivery_address || "your address"}.`
      : `Ready for pickup at: ${order.shop_address || "Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya"}.`,
    order.delivery_fee && order.delivery_fee > 0 ? `Delivery fee: KES ${order.delivery_fee}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendWhatsApp(order.customer_phone, body);
}

/**
 * Notify customer of a status change.
 */
export async function notifyStatusChange(order: {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  delivery_method: "delivery" | "pickup";
}): Promise<void> {
  const statusMessages: Record<string, string> = {
    paid: "Payment confirmed. We're preparing your order.",
    preparing: "Your order is being prepared.",
    ready_for_delivery: "Your order is ready for delivery.",
    ready_for_pickup: "Your order is ready for pickup.",
    out_for_delivery: "Your order is on the way.",
    delivered: "Your order has been delivered. Thank you!",
    cancelled: "Your order has been cancelled.",
  };

  const message = statusMessages[order.status] || `Your order status is now: ${order.status}`;

  const body = [
    `Hi ${order.customer_name},`,
    `Update on your order ${order.order_number}:`,
    message,
    "",
    "Thank you for shopping with Pedigree Leather!",
  ].join("\n");

  await sendWhatsApp(order.customer_phone, body);
}