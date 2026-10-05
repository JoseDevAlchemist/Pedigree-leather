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
 * Whether this email may use the admin at all.
 *
 * An explicit list, because "any authenticated user is an admin" is the wrong default
 * for a shop: the moment signup exists, anyone who creates an account inherits write
 * access to the catalogue. `AUTH_EMAILS` in .env.local is the allow-list; empty
 * means "no allow-list configured", which denies everything and says so, rather than
 * quietly allowing everyone.
 *
 * This is belt-and-braces against the RLS policy in 001_initial.sql, which grants
 * `authenticated` full access because the database has no concept of a staff role
 * yet. The narrowing belongs here, where it can be changed without a migration.
 */
export function isAllowedAdmin(email: string | undefined): boolean {
  if (!email) return false;

  const allowList = (process.env.AUTH_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  /* No allow-list means nobody. Failing closed is the whole point: the alternative
     is a missing env var quietly turning every Supabase user into an admin. */
  if (allowList.length === 0) return false;

  return allowList.includes(email.toLowerCase());
}

/**
 * `requireAdmin` plus the allow-list. The check every admin action uses.
 *
 * Throws rather than returning null, because a caller that forgot to handle a null
 * here would silently proceed unauthenticated — the exact failure the function
 * exists to prevent.
 */
export async function requireAdminUser(): Promise<User> {
  const user = await requireAdmin();

  if (!isAllowedAdmin(user.email)) {
    /* Signed in with Supabase, but not on the list. Deliberately does not redirect
       — it throws, so the action returns an error and the person sees why instead of
       being bounced to the dashboard and bounced back. */
    throw new Error(
      `${user.email ?? "That account"} is signed in but is not on the admin allow-list. ` +
        "Add it to AUTH_EMAILS in .env.local.",
    );
  }

  return user;
}