import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable();
const url = z.url({ protocol: /^https?$/ }).max(2048).nullable();
const email = z.email().max(254).nullable();
const phone = z.string().trim().regex(/^\+?[\d ()-]{7,24}$/).refine(value => /^\d{7,15}$/.test(value.replace(/\D/g, "")));
const fee = z.number().int().min(0).max(100_000_000);
const asset = z.string().regex(/^(logo|favicon|social)\/[0-9a-f-]{36}\.(jpg|png|webp)$/).nullable();

export const publicPreferences = z.object({
  business_name: optionalText(120),
  support_email: email,
  operating_hours: optionalText(500),
  facebook_url: url,
  tiktok_url: url,
  other_social_url: url,
  announcement: optionalText(240),
  announcement_enabled: z.boolean(),
  logo: asset,
  favicon: asset,
  social: asset,
  stk_enabled: z.boolean(),
  pay_at_pickup: z.boolean(),
  pay_on_delivery: z.boolean(),
  stk_wait_seconds: z.number().int().min(15).max(180),
  manual_payment_instructions: optionalText(500),
  hide_unavailable: z.boolean(),
  feature_first: z.boolean(),
  show_discount_badge: z.boolean(),
  tax_display_note: optionalText(160),
  homepage_sort: z.enum(["newest", "price_asc", "price_desc"]).nullable(),
  delivery_enabled: z.boolean(),
  pickup_address: optionalText(400),
  pickup_hours: optionalText(400),
  pickup_instructions: optionalText(800),
  delivery_estimate: optionalText(160),
  preparation_time: optionalText(160),
  checkout_instructions: optionalText(800),
  hero_title: optionalText(120),
  hero_description: optionalText(500),
  maintenance_message: optionalText(400),
  seo_title: optionalText(120),
  seo_description: optionalText(320),
  sharing_title: optionalText(120),
  sharing_description: optionalText(320),
  allow_indexing: z.boolean(),
  search_verification: z.string().regex(/^[A-Za-z0-9_-]{1,150}$/).nullable(),
}).partial();

export const coreSettings = z.object({
  shop_name: z.string().trim().min(1).max(120),
  phone,
  whatsapp: phone.transform(value => value.replace(/\D/g, "")),
  email,
  address: z.string().trim().min(5).max(400),
  google_maps_url: url,
  instagram_url: url,
  exchange_rate_kes_to_usd: z.number().positive().max(100_000),
  delivery_flat_rate: fee,
  free_delivery_threshold: fee,
  pickup_available: z.boolean(),
});

export const inventoryPreferences = z.object({
  low_stock_threshold: z.number().int().min(0).max(100_000),
  show_admin_codes: z.boolean(),
  show_colour_stock: z.boolean(),
  show_size_stock: z.boolean(),
}).partial();

export const notificationPreferences = z.object({
  notify_new_order: z.boolean(),
  notify_customer_order: z.boolean(),
  notify_customer_status: z.boolean(),
  notify_customer_cancellation: z.boolean(),
  notify_payment_receipt: z.boolean(),
  notification_phones: z.string().trim().max(199).refine(value =>
    value.split(",").length <= 10 && value.split(",").every(phone => /^\+254[17]\d{8}$/.test(phone.trim()))
  ).nullable(),
}).partial();

export const adminPreferences = inventoryPreferences.extend(notificationPreferences.shape);

export const inventoryDefaults = {
  low_stock_threshold: 0,
  show_admin_codes: true,
  show_colour_stock: true,
  show_size_stock: false,
};

export const policySettings = z.object({
  terms: z.string().trim().min(1).max(20_000),
  returns: z.string().trim().min(1).max(20_000),
}).partial();

export const settingValues = coreSettings.extend(publicPreferences.shape).extend(adminPreferences.shape).extend(policySettings.shape);
export type PreferenceValues = z.infer<typeof publicPreferences>;
export type SettingKey = keyof z.infer<typeof settingValues>;
export type SettingValue = string | number | boolean | null;
export type SettingsValues = Partial<Record<SettingKey, SettingValue>>;
