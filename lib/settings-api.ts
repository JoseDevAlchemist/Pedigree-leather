import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
  updated_at: string | null;
}

export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", "default")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Return defaults if no row exists yet
      return {
        id: "default",
        shop_name: "Pedigree Leather",
        phone: "+254143354741",
        whatsapp: "254143354741",
        email: null,
        address: "Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya",
        google_maps_url: null,
        delivery_flat_rate: 300,
        free_delivery_threshold: 25000,
        pickup_available: true,
        updated_at: null,
      };
    }
    rethrow(error, "fetch shop settings");
  }

  return data as ShopSettings;
}

export async function updateShopSettings(
  input: Partial<Omit<ShopSettings, "id" | "updated_at">>
): Promise<ShopSettings> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("shop_settings")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", "default")
    .select()
    .single();

  if (error) rethrow(error, "update shop settings");

  return data as ShopSettings;
}