import "server-only";

/**
 * Roles system — server-only module for admin authorization.
 *
 * Reads the current Supabase session, looks up the user's email in the
 * admin_users table, and returns their role. Used by middleware and
 * server actions to enforce role-based access.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Role = "owner" | "worker";

export interface AdminUser {
  email: string;
  role: Role;
  displayName: string | null;
}

/**
 * Get the current admin user from the session.
 * Returns null if not authenticated or not in admin_users table.
 */
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("email, role, display_name")
    .eq("email", user.email)
    .single();

  if (error || !adminUser) return null;

  return {
    email: adminUser.email,
    role: adminUser.role as Role,
    displayName: adminUser.display_name,
  };
}

/**
 * Require a specific role. Throws redirect if user doesn't have it.
 * Owner can access worker routes; worker cannot access owner routes.
 */
export async function requireRole(requiredRole: Role): Promise<AdminUser> {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login?error=not_authorized");
  }

  const roleHierarchy: Record<Role, number> = {
    owner: 2,
    worker: 1,
  };

  if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    redirect("/admin?error=insufficient_role");
  }

  return user;
}

/**
 * Check if user is an owner.
 */
export function isOwner(user: AdminUser): boolean {
  return user.role === "owner";
}

/**
 * Check if user is a worker.
 */
export function isWorker(user: AdminUser): boolean {
  return user.role === "worker";
}

/**
 * Get all admin users (owner only).
 */
export async function getAllAdminUsers(): Promise<AdminUser[]> {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("email, role, display_name")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((u) => ({
    email: u.email,
    role: u.role as Role,
    displayName: u.display_name,
  }));
}

/**
 * Create a new admin user (owner only).
 */
export async function createAdminUser(
  email: string,
  role: Role,
  displayName?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = await createClient();

  const { error } = await supabase.from("admin_users").insert({
    email,
    role,
    display_name: displayName || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Email already exists" };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Update an admin user's role/display name (owner only).
 */
export async function updateAdminUser(
  email: string,
  updates: { role?: Role; display_name?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = await createClient();

  // Prevent self-demotion
  const currentUser = await getCurrentAdminUser();
  if (currentUser?.email === email && updates.role === "worker") {
    return { ok: false, error: "Cannot change your own role" };
  }

  // Prevent removing last owner
  if (updates.role === "worker") {
    const { data: owners } = await supabase
      .from("admin_users")
      .select("email")
      .eq("role", "owner");

    if (owners && owners.length === 1 && owners[0].email === email) {
      return { ok: false, error: "Cannot remove the last owner" };
    }
  }

  const { error } = await supabase
    .from("admin_users")
    .update(updates)
    .eq("email", email);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/**
 * Delete an admin user (owner only).
 */
export async function deleteAdminUser(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("owner");
  const supabase = await createClient();

  const currentUser = await getCurrentAdminUser();
  if (currentUser?.email === email) {
    return { ok: false, error: "Cannot delete yourself" };
  }

  // Prevent removing last owner
  const { data: targetUser } = await supabase
    .from("admin_users")
    .select("role")
    .eq("email", email)
    .single();

  if (targetUser?.role === "owner") {
    const { data: owners } = await supabase
      .from("admin_users")
      .select("email")
      .eq("role", "owner");

    if (owners && owners.length === 1) {
      return { ok: false, error: "Cannot remove the last owner" };
    }
  }

  const { error } = await supabase.from("admin_users").delete().eq("email", email);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}