"use server";

import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/supabase/guards";
import { revalidatePath } from "next/cache";

/**
 * ============================================================================
 * Sign in and sign out.
 * ============================================================================
 *
 * Both are server actions because both mutate a cookie, and a cookie written from a
 * server action is committed to the response. Doing either from a client component
 * would mean either a round trip with the token exposed to the browser, or a
 * cookie-setting endpoint that anything could call — and an endpoint that anyone can
 * call to sign *themselves out* is not obviously harmless either.
 *
 * The failure messages here are the one place this project chooses not to explain
 * itself in full, and deliberately: "that email is not registered" and "that password
 * is wrong" are different sentences, and telling them apart tells an attacker which
 * of a list of addresses has an account. Both failures return the same sentence.
 */

export type AuthResult = { ok: true } | { ok: false; error: string };

/** One sentence for both credential failure modes, and it does not say which. */
const INVALID_CREDENTIALS = "That email and password do not match an account.";

/**
 * The allow-list failure gets its own, different message.
 *
 * That is a deliberate trade against the rule above, and worth being explicit about
 * rather than looking like an oversight: the message discloses that an address is on
 * the admin list, which is a small leak, and it buys a real thing. The person hitting
 * it is almost always whoever is setting the admin up for the first time, following
 * `docs/SETUP.md`, and "that address is not on the admin allow-list" tells them
 * exactly which line of `.env.local` to edit. A generic "wrong password" there would
 * send them looking for a typo in a password that is perfectly correct.
 *
 * What the timing equalisation below still protects is the larger question — which
 * addresses have accounts *at all*. That is worth hiding and is not disclosed by the
 * wording of any message.
 */
const NOT_ON_ALLOW_LIST =
  "That address is signed in, but it is not on the admin allow-list. Add it to AUTH_EMAILS in .env.local.";

/** A generic message, for anything that is not a credentials problem. */
function explain(error: unknown): string {
  console.error("[admin/auth]:", error);
  const message = error instanceof Error ? error.message : "";
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  return "Sign in failed. Check the details and try again.";
}

export async function loginAction(
  email: string,
  password: string,
): Promise<AuthResult> {
  const trimmed = email.trim();

  /* Checked here as well as in `requireAdminUser`. A person on the wrong side of the
     allow-list should be told so on the login form, where they can act on it —
     rather than being signed in successfully and then hitting a wall on the first
     page. The check is repeated server-side on every admin request, because this one
     is for the message and that one is for the enforcement. */
  if (!isAllowedAdmin(trimmed)) {
    /* Still attempt the sign-in, and report the same error either way, so an
       address with no account and an address with one take the same time and produce
       the same result. Otherwise this branch is a working oracle for "which addresses
       exist here", which is the enumeration worth preventing. */
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });

      /* If the credentials were *good*, this is the real reason for the refusal and
         the person needs to know it. If they were not, this is someone guessing, and
         they get the generic sentence. */
      if (!error && data.user) {
        await supabase.auth.signOut();
        return { ok: false, error: NOT_ON_ALLOW_LIST };
      }
    } catch {
      /* Swallowed: an unreachable auth server produces the generic message below. */
    }

    return { ok: false, error: INVALID_CREDENTIALS };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        return { ok: false, error: INVALID_CREDENTIALS };
      }
      return { ok: false, error: explain(error) };
    }

    if (!data.user) {
      return { ok: false, error: INVALID_CREDENTIALS };
    }

    /* A second gate: Supabase said the credentials are good, but the allow-list is
       checked against the address it *returned* rather than the one that was typed,
       so a case difference or an alias cannot slip a different account through. */
    if (!isAllowedAdmin(data.user.email)) {
      await supabase.auth.signOut();
      return { ok: false, error: NOT_ON_ALLOW_LIST };
    }

    /* The admin tree reads cached server data, and a fresh session should not render
       a stale dashboard for one navigation. */
    revalidatePath("/admin", "layout");

    return { ok: true };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function logoutAction(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: explain(error) };

    /* Clear anything cached for the tree that was fetched while signed in. Not
       cosmetic: without this, a shared machine can render the previous admin's
       dashboard for one navigation after sign-out. */
    revalidatePath("/admin", "layout");

    return { ok: true };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

/**
 * Whether there is a session at all.
 *
 * Not "whether the session is allowed" — `isAllowedAdmin` answers that, and it needs
 * an email, which this deliberately does not return. A client that could ask "is this
 * browser an admin?" would be an information leak about a signed-in account.
 */
export async function hasSessionAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { ok: Boolean(user) };
  } catch {
    return { ok: false };
  }
}