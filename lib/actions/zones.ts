"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type DeliveryZone = Database["public"]["Tables"]["delivery_zones"]["Row"];

const zoneSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fee: z.number().int().min(0).max(100_000_000),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(100_000),
});

export async function listZones(): Promise<DeliveryZone[]> {
  await requireRole("owner");
  const db = await createClient();
  const { data, error } = await db.from("delivery_zones").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export async function saveZoneAction(input: unknown, editing: { id: string; updated_at: string } | null) {
  await requireRole("owner");
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Enter a zone name, a whole-shilling fee and a valid sort order." };
  const identity = z.object({ id: z.uuid(), updated_at: z.iso.datetime({ offset: true }) }).nullable().safeParse(editing);
  if (!identity.success) return { ok: false as const, error: "Invalid delivery zone." };

  const db = await createClient();
  const target = identity.data;
  const query = target
    ? db.from("delivery_zones").update(parsed.data).eq("id", target.id).eq("updated_at", target.updated_at)
    : db.from("delivery_zones").insert(parsed.data);
  const { data, error } = await query.select("*").maybeSingle();

  if (error) return { ok: false as const, error: "Could not save the delivery zone. Check the settings migration and try again." };
  if (!data) return { ok: false as const, error: "This zone changed in another session. Reload before saving." };
  revalidatePath("/checkout");
  return { ok: true as const, zone: data };
}
