"use server";

import { storefrontCache } from "@/lib/storefront-cache";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationAvailability } from "@/lib/notification-settings";
import { isStkConfigured } from "@/lib/payments/config";
import { getShopSettings } from "@/lib/settings-api";
import { adminPreferences, coreSettings, policySettings, settingValues, type SettingsValues } from "@/lib/settings-schema";
import { settingsSections } from "@/lib/settings-sections";

const requestSchema = z.object({
  section: z.string(),
  version: z.iso.datetime({ offset: true }).nullable(),
  values: settingValues.partial().strict(),
});
const brandBucket = "store-branding";

async function imageExtension(file: File) {
  if (!file.size || file.size > 480 * 1024) return null;
  const bytes = Buffer.from(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (file.type === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function saveSettingsAction(section: string, version: string | null, values: SettingsValues, uploads: FormData) {
  const owner = await requireRole("owner");
  const fields = settingsSections.find(item => item.id === section)?.groups?.flatMap(group => group.fields) ?? [];
  const parsed = requestSchema.safeParse({ section, version, values });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const label = fields.find(([key]) => key === issue.path[1])?.[1];
    return { ok: false as const, error: label ? `Check the value for “${label}”.` : "Invalid settings request." };
  }
  const allowed = new Map(fields.map(([key, , kind]) => [key, kind]));
  if (!fields.length || Object.keys(values).some(key => !allowed.has(key as keyof SettingsValues)) ||
      Array.from(uploads.keys()).some(key => allowed.get(key as keyof SettingsValues) !== "image") ||
      Object.entries(parsed.data.values).some(([key, value]) => allowed.get(key as keyof SettingsValues) === "image" && value !== null)) {
    return { ok: false as const, error: "That setting is unavailable in this section." };
  }

  const changes = { ...parsed.data.values };
  if (changes.stk_enabled === true && !isStkConfigured()) {
    return { ok: false as const, error: "Configure M-Pesa STK Push before enabling it." };
  }
  if (section === "notifications") {
    const available = notificationAvailability();
    const whatsappKeys = ["notify_new_order", "notify_customer_order", "notify_customer_status", "notify_customer_cancellation"] as const;
    if ((!available.whatsapp && whatsappKeys.some(key => changes[key] === true)) || (!available.email && changes.notify_payment_receipt === true)) {
      return { ok: false as const, error: "Configure the notification provider before enabling delivery." };
    }
  }
  const pendingImages: { key: "logo" | "favicon" | "social"; file: File; extension: string }[] = [];
  const uploadedPaths: string[] = [];

  try {
    const current = await getShopSettings();
    if (current.updated_at !== version) {
      return { ok: false as const, error: "Settings changed in another session. Reload before saving." };
    }

    for (const key of ["logo", "favicon", "social"] as const) {
      const file = uploads.get(key);
      if (file === null) continue;
      const extension = file instanceof File ? await imageExtension(file) : null;
      if (!(file instanceof File) || !extension || uploads.getAll(key).length !== 1) {
        return { ok: false as const, error: "Select a JPEG, PNG or WebP image up to 480 KB." };
      }
      pendingImages.push({ key, file, extension });
    }

    const db = createAdminClient();
    for (const { key, file, extension } of pendingImages) {
      const path = `${key}/${crypto.randomUUID()}.${extension}`;
      const { error } = await db.storage.from(brandBucket).upload(path, file, {
        cacheControl: "31536000", contentType: file.type, upsert: false,
      });
      if (error) {
        if (uploadedPaths.length) await db.storage.from(brandBucket).remove(uploadedPaths);
        return { ok: false as const, error: "Image upload failed. Check that the branding bucket is configured." };
      }
      uploadedPaths.push(path);
      changes[key] = path;
    }

    const core: SettingsValues = {};
    const preferences: SettingsValues = {};
    const privateSettings: SettingsValues = {};
    const policies: SettingsValues = {};
    for (const key of Object.keys(changes) as (keyof SettingsValues)[]) {
      const target = Object.hasOwn(coreSettings.shape, key) ? core
        : Object.hasOwn(adminPreferences.shape, key) ? privateSettings
        : Object.hasOwn(policySettings.shape, key) ? policies : preferences;
      target[key] = changes[key];
    }
    const { data, error } = await db.rpc("save_website_settings", {
      p_actor: owner.email, p_version: version, p_core: core, p_preferences: preferences, p_private: privateSettings, p_policies: policies,
    });
    if (error) {
      // Only remove uploads when PostgreSQL explicitly rejected the transaction.
      if (/^(40001|22023|42501|P0002)$/.test(error.code) && uploadedPaths.length) {
        await db.storage.from(brandBucket).remove(uploadedPaths);
      }
      const message = error.code === "40001" ? "Settings changed in another session. Reload before saving."
        : error.message === "settings_fulfilment_required" ? "Keep at least one fulfilment method available."
        : "Could not save settings. Check the settings migration and try again.";
      return { ok: false as const, error: message };
    }
    if (Object.keys(core).length || Object.keys(preferences).length) {
      updateTag(storefrontCache.settings.tag);
      if (section === "delivery" || section === "orders") revalidatePath("/checkout");
      if (section === "seo") revalidatePath("/sitemap.xml");
    }
    if (section === "inventory" && Object.keys(privateSettings).length) revalidatePath("/admin/products");
    for (const slug of Object.keys(policies)) revalidatePath(`/legal/${slug}`);
    return {
      ok: true as const, version: data, values: changes,
      rateUpdated: changes.exchange_rate_kes_to_usd !== undefined &&
        changes.exchange_rate_kes_to_usd !== current.exchange_rate_kes_to_usd ? data : current.exchange_rate_updated_at,
    };
  } catch (error) {
    console.error("[settings] save failed", error);
    return { ok: false as const, error: "Could not save settings. Reload the section to check the current values." };
  }
}

export async function refreshStorefrontAction() {
  await requireRole("owner");
  for (const rule of Object.values(storefrontCache)) updateTag(rule.tag);
  revalidatePath("/(shop)", "layout");
  revalidatePath("/sitemap.xml");
}

export async function revokeOtherSessionsAction() {
  const owner = await requireRole("owner");
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: "others" });
  if (error) return "Could not revoke the other sessions.";

  try {
    const { error: auditError } = await createAdminClient().from("shop_settings_audit").insert({
      actor: owner.email, changes: { security: "Other sessions revoked" },
    });
    if (auditError) return "Other sessions were revoked. Audit recording is unavailable.";
  } catch {
    return "Other sessions were revoked. Audit recording is unavailable.";
  }
  return "Other sessions were revoked. Existing access tokens expire on their normal schedule.";
}
