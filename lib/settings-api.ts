import "server-only";

import { cache } from "react";
import { publicPreferences, type PreferenceValues } from "@/lib/settings-schema";

import { DEFAULT_USD_EXCHANGE_RATE } from "@/lib/exchange-rate";
import { createPublicClient } from "@/lib/supabase/public";

function rethrow(error: unknown, context: string): never {
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[settings-api] ${context}:`, error);

  if (code === "42P01" || /PGRST205|Could not find the table|schema cache/i.test(message)) {
    throw new Error(
      `Supabase has no table for this query (${code || "PGRST205"}). The migration has not been ` +
        "applied to this project — run supabase/migrations/001_initial.sql and 002_storage.sql, " +
        "then seed.sql. See docs/SETUP.md.",
      { cause: error },
    );
  }

  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    throw new Error(
      "The database refused this read because of a row-level security policy. Either this " +
        "operation needs the service role key (check SUPABASE_SERVICE_ROLE_KEY) or the policies " +
        "in 001_initial.sql are missing.",
      { cause: error },
    );
  }

  if (code === "57014" || /statement timeout/i.test(message)) {
    throw new Error("That query took too long and was cancelled by the database.", {
      cause: error,
    });
  }

  throw new Error(`Could not ${context.replace(/_/g, " ")}. The details are in the server log.`, {
    cause: error,
  });
}

export interface ShopSettings {
  id: string;
  shop_name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string;
  google_maps_url: string | null;
  delivery_flat_rate: number;
  free_delivery_threshold: number;
  pickup_available: boolean;
  instagram_handle: string | null;
  instagram_url: string | null;
  exchange_rate_kes_to_usd: number;
  updated_at: string | null;
  exchange_rate_updated_at: string | null;
  storefront_preferences: PreferenceValues;
}

export const getShopSettings = cache(async function getShopSettings(): Promise<ShopSettings> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", "default")
    .single();

  if (error) rethrow(error, "load the shop settings");
  const preferences = publicPreferences.safeParse(data.storefront_preferences);
  return {
    ...data,
    storefront_preferences: preferences.success ? preferences.data : {},
    exchange_rate_kes_to_usd: data.exchange_rate_kes_to_usd ?? DEFAULT_USD_EXCHANGE_RATE,
  };
});

export async function getStorefrontPreferences(): Promise<PreferenceValues> {
  try {
    return (await getShopSettings()).storefront_preferences;
  } catch {
    return {};
  }
}

export function brandingBaseUrl() {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return origin ? `${origin.replace(/\/$/, "")}/storage/v1/object/public/store-branding` : undefined;
}

export function brandingUrl(path: string | null | undefined) {
  const base = brandingBaseUrl();
  return path && base ? `${base}/${path}` : undefined;
}

export interface DeliveryZoneSummary {
  id: string;
  name: string;
  fee: number;
}

/**
 * Look up an active delivery zone by id.
 *
 * Server actions must not take the fee from the client: the checkout browser
 * can only be trusted for *which* zone was chosen, never for how much it
 * costs. Returns null for unknown or deactivated zones so the caller can ask
 * the customer to pick again rather than silently charging the flat rate.
 */
export async function getActiveDeliveryZone(
  zoneId: string,
): Promise<DeliveryZoneSummary | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id, name, fee")
    .eq("id", zoneId)
    .eq("active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    rethrow(error, "load the delivery zone");
  }

  return data as DeliveryZoneSummary;
}

export async function hasActiveDeliveryZones(): Promise<boolean> {
  const { data, error } = await createPublicClient()
    .from("delivery_zones").select("id").eq("active", true).limit(1);
  if (error) rethrow(error, "load active delivery zones");
  return data.length > 0;
}
