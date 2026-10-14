"use server";

import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

const zoneSchema = z.object({
  name: z.string().min(1, "Zone name is required"),
  fee: z.coerce.number().min(0, "Fee must be positive"),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().default(0),
});

export async function listZones(): Promise<DeliveryZone[]> {
  await requireRole("owner");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []) as DeliveryZone[];
}

export async function createZoneAction(
  formData: FormData
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireRole("owner");
    const supabase = createAdminClient();

    const rawData = {
      name: formData.get("name"),
      fee: formData.get("fee"),
      active: formData.get("active") === "true",
      sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
    };

    const parsed = zoneSchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    const { data, error } = await supabase
      .from("delivery_zones")
      .insert(parsed.data)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/zones");
    revalidatePath("/checkout");

    return { ok: true, id: data.id };
  } catch (error) {
    console.error("[createZoneAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function updateZoneAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole("owner");
    const supabase = createAdminClient();

    const id = formData.get("id") as string;
    if (!id) return { ok: false, error: "Zone ID is required" };

    const rawData = {
      name: formData.get("name"),
      fee: formData.get("fee"),
      active: formData.get("active") === "true",
      sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
    };

    const parsed = zoneSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    const { error } = await supabase
      .from("delivery_zones")
      .update(parsed.data)
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/zones");
    revalidatePath("/checkout");

    return { ok: true };
  } catch (error) {
    console.error("[updateZoneAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function deleteZoneAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole("owner");
    const supabase = createAdminClient();

    const id = formData.get("id") as string;
    if (!id) return { ok: false, error: "Zone ID is required" };

    const { error } = await supabase
      .from("delivery_zones")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/zones");
    revalidatePath("/checkout");

    return { ok: true };
  } catch (error) {
    console.error("[deleteZoneAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}