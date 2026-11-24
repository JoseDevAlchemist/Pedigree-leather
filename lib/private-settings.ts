import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPreferences } from "@/lib/settings-schema";

export const getPrivateSettings = cache(async function getPrivateSettings() {
  try {
    const { data, error } = await createAdminClient().from("website_admin_preferences").select("preferences").eq("id", "default").single();
    if (error) return null;
    const result = adminPreferences.safeParse(data.preferences);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
});
