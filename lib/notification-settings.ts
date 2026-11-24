import "server-only";

import type { z } from "zod";
import type { notificationPreferences } from "@/lib/settings-schema";
import { getPrivateSettings } from "@/lib/private-settings";

export function notificationAvailability() {
  return {
    email: Boolean(process.env.RESEND_API_KEY?.trim()),
    whatsapp: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()),
  };
}

export async function getNotificationSettings() {
  const settings = await getPrivateSettings();
  if (!settings) return null;
  return resolveNotificationSettings(settings);
}

export function resolveNotificationSettings(settings: z.infer<typeof notificationPreferences>) {
  const available = notificationAvailability();
  return {
    notify_new_order: settings.notify_new_order ?? available.whatsapp,
    notify_customer_order: settings.notify_customer_order ?? available.whatsapp,
    notify_customer_status: settings.notify_customer_status ?? available.whatsapp,
    notify_customer_cancellation: settings.notify_customer_cancellation ?? available.whatsapp,
    notify_payment_receipt: settings.notify_payment_receipt ?? available.email,
    notification_phones: settings.notification_phones,
  };
}
