import "server-only";

import { getPrivateSettings } from "@/lib/private-settings";
import { inventoryDefaults, inventoryPreferences } from "@/lib/settings-schema";

export async function getInventoryPreferences(): Promise<typeof inventoryDefaults | null> {
  const preferences = await getPrivateSettings();
  if (!preferences) return null;
  return { ...inventoryDefaults, ...inventoryPreferences.parse(preferences) };
}
