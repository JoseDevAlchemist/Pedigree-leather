import "server-only";

import { z } from "zod";
import { adminPreferences, publicPreferences } from "@/lib/settings-schema";
import { createAdminClient } from "@/lib/supabase/admin";

const snapshotSchema = z.object({
  shop: z.looseObject({
    updated_at: z.string().nullable(),
    exchange_rate_updated_at: z.string().nullable(),
    storefront_preferences: publicPreferences,
  }),
  private: adminPreferences.nullable(),
});

const errors = {
  rpc: "The settings read function is unavailable. Check the database migration and API schema cache.",
  schema: "The settings function could not read a required table or column. Check the deployed database schema.",
  access: "The database denied access to store settings. Check the settings service role and its grants.",
  empty: "The database returned no settings. Check the default store row and owner record.",
  invalid: "The database returned settings in an unexpected format. Check the settings schema and saved values.",
  private: "The database returned no private preferences for this section. Check the default admin preferences row.",
  unavailable: "Could not reach the store settings service. Check the server connection and reload.",
} as const;

function loadFailure(section: string, reason: keyof typeof errors, code?: string) {
  console.error("[admin-settings] snapshot failed", { section, reason, code });
  return { ok: false as const, message: errors[reason] };
}

export async function loadAdminSettingsSnapshot(owner: string, section: string) {
  try {
    const { data, error } = await createAdminClient().rpc("read_website_settings", {
      p_actor: owner,
      p_section: section,
    });
    if (error) {
      const reason = error.code === "PGRST202" || error.code === "42883" ? "rpc"
        : ["42P01", "42703", "PGRST205"].includes(error.code) ? "schema"
        : error.code === "42501" || error.code === "PGRST301" ? "access"
        : "unavailable";
      return loadFailure(section, reason, error.code);
    }
    if (data === null) return loadFailure(section, "empty");

    const parsed = snapshotSchema.safeParse(data);
    if (!parsed.success) return loadFailure(section, "invalid");
    if ((section === "inventory" || section === "notifications") && !parsed.data.private) {
      return loadFailure(section, "private");
    }
    return { ok: true as const, data: parsed.data };
  } catch {
    return loadFailure(section, "unavailable");
  }
}
