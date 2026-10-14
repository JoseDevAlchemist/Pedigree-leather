"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export interface AdminUser {
  id: string;
  email: string;
  role: "owner" | "worker";
  display_name: string | null;
  created_at: string;
}

export async function getAllStaff(): Promise<AdminUser[]> {
  await requireRole("owner");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role as "owner" | "worker",
    display_name: u.display_name,
    created_at: u.created_at,
  }));
}

export async function createStaffAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = createAdminClient();

  const email = formData.get("email") as string;
  const role = formData.get("role") as "owner" | "worker";
  const displayName = formData.get("display_name") as string | null;

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Valid email is required" };
  }

  const { error } = await supabase.from("admin_users").insert({
    email: email.toLowerCase().trim(),
    role,
    display_name: displayName?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Email already exists" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateStaffAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = createAdminClient();

  const id = formData.get("id") as string;
  const role = formData.get("role") as "owner" | "worker" | null;
  const displayName = formData.get("display_name") as string | null;

  if (!id) return { ok: false, error: "ID required" };

  // Get current user to prevent self-demotion
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentUser } = await supabase
    .from("admin_users")
    .select("email, role")
    .eq("id", id)
    .single();

  if (currentUser?.email === user?.email && role === "worker") {
    return { ok: false, error: "Cannot change your own role" };
  }

  // Prevent removing last owner
  if (currentUser?.role === "owner" && role === "worker") {
    const { data: owners } = await supabase
      .from("admin_users")
      .select("id")
      .eq("role", "owner");

    if (owners && owners.length === 1) {
      return { ok: false, error: "Cannot remove the last owner" };
    }
  }

  const updates: { role?: "owner" | "worker"; display_name?: string | null } = {};
  if (role) updates.role = role;
  if (displayName !== undefined) updates.display_name = displayName;

  const { error } = await supabase
    .from("admin_users")
    .update(updates)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function deleteStaffAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = createAdminClient();

  const id = formData.get("id") as string;

  if (!id) return { ok: false, error: "ID required" };

  // Get current user to prevent self-deletion
  const { data: { user } } = await supabase.auth.getUser();
  const { data: targetUser } = await supabase
    .from("admin_users")
    .select("email, role")
    .eq("id", id)
    .single();

  if (targetUser?.email === user?.email) {
    return { ok: false, error: "Cannot delete yourself" };
  }

  // Prevent removing last owner
  if (targetUser?.role === "owner") {
    const { data: owners } = await supabase
      .from("admin_users")
      .select("id")
      .eq("role", "owner");

    if (owners && owners.length === 1) {
      return { ok: false, error: "Cannot remove the last owner" };
    }
  }

  const { error } = await supabase.from("admin_users").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/staff");
  return { ok: true };
}