import "server-only";

import type { PreferenceValues } from "@/lib/settings-schema";

export function isStkConfigured() {
  const fields = [
    process.env.MPESA_CONSUMER_KEY,
    process.env.MPESA_CONSUMER_SECRET,
    process.env.MPESA_SHORTCODE,
    process.env.MPESA_PASSKEY,
    process.env.MPESA_CALLBACK_URL,
  ];
  if (fields.some(value => !value?.trim())) return false;
  try {
    const callback = new URL(process.env.MPESA_CALLBACK_URL!);
    return callback.protocol === "https:" && callback.hostname !== "localhost";
  } catch {
    return false;
  }
}

export function allowsDeferredPayment(settings: PreferenceValues, deliveryMethod: string) {
  if (deliveryMethod === "pickup") return settings.pay_at_pickup !== false;
  return deliveryMethod === "delivery" && settings.pay_on_delivery !== false;
}
