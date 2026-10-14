import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================================
 * Server-only. Import from server actions or server components only.
 * ============================================================================
 *
 * The session check, in one place.
 *
 * Every admin page and every admin server action calls `requireAdmin()` before
 * doing anything. That is not paranoia and it is not belt-and-braces: `proxy.ts`
 * already redirects unauthenticated visitors away from `/admin`, and this is still
 * necessary, for three reasons.
 *
 *  1. **The proxy is a redirect, not a lock.** It runs on the happy path and costs a
 *     network round trip. Anything that protects data must not depend on it.
 *  2. **Server actions are public endpoints.** A form's action can be invoked by
 *     anything that can reach the URL, including a script that never renders the
 *     page and so never triggers a client-side redirect.
 *  3. **The proxy can be renamed away.** It is one file at the project root. If a
 *     future refactor drops it, nothing here changes and nothing opens up.
 *
 * `getUser()` rather than `getSession()`: it revalidates the token with the auth
 * server instead of decoding it and trusting the contents. A forged JWT would sail
 * through `getSession`.
 */

/**
 * The signed-in user, or `null`.
 *
 * Used by the admin layout, which renders a session rather than redirecting — the
 * login page has to render *inside* the admin tree, so the layout cannot bounce
 * unauthenticated visitors or the login page could never be reached.
 */
export async function getCurrentAdmin(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    /* No client means no env vars means no session. A redirect loop caused by an
       exception here would be much harder to diagnose than a plain "not signed in". */
    return null;
  }
}

/**
 * The signed-in user, or a thrown redirect to the login page.
 *
 * `redirect()` throws internally, so this is called as `const user =
 * await requireAdmin()` and never as `if (!await requireAdmin())`.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentAdmin();

  /* Statically imported, and that is load-bearing for the types as well as for
     clarity: `redirect` returns `never`, so the compiler narrows `user` to `User`
     after this `if`. A dynamic `await import` inside the branch loses that, and the
     function's return type has to be asserted instead. */
  if (!user) redirect("/admin/login");

  return user;
}

/**
 * Whether this email is an admin user (exists in admin_users table).
 *
 * Replaces the old AUTH_EMAILS env var approach. The database is the source
 * of truth for who can access admin.
 */
export async function isAllowedAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", email)
      .single();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the admin user's role.
 */
export async function getAdminRole(
  email: string
): Promise<"owner" | "worker" | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("role")
      .eq("email", email)
      .single();

    if (error || !data) return null;
    return data.role as "owner" | "worker";
  } catch {
    return null;
  }
}

/**
 * `requireAdmin` plus the admin_users check. The check every admin action uses.
 *
 * Redirects to login with error if not in admin_users.
 */
export async function requireAdminUser(): Promise<User> {
  const user = await requireAdmin();

  if (!await isAllowedAdmin(user.email)) {
    /* Signed in with Supabase, but not in admin_users. Redirect to login with error. */
    redirect("/admin/login?error=not_authorized");
  }

  return user;
}

/**
 * Require a specific role. Owner can access worker routes; worker cannot access owner routes.
 */
export async function requireAdminRole(
  requiredRole: "owner" | "worker"
): Promise<User> {
  const user = await requireAdminUser();

  if (!user.email) {
    redirect("/admin/login?error=not_authorized");
  }

  const role = await getAdminRole(user.email);

  if (!role) {
    redirect("/admin/login?error=not_authorized");
  }

  const roleHierarchy: Record<"owner" | "worker", number> = {
    owner: 2,
    worker: 1,
  };

  if (roleHierarchy[role] < roleHierarchy[requiredRole]) {
    redirect("/admin?error=insufficient_role");
  }

  return user;
}