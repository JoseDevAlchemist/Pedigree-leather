import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * A stateless server client, for reads nobody has to sign in for.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists, and why `lib/supabase/server.ts` cannot do this job
 * ---------------------------------------------------------------------------
 * The cookie-aware client in `server.ts` calls `cookies()`. Calling `cookies()` opts a
 * route out of static rendering, so using it for the shop's product reads turned
 * `/`, `/bags`, `/shoes` and all twelve product pages from prerendered (`○`) into
 * server-rendered on demand (`ƒ`) — every page view became a database round trip, and
 * the build printed a misleading "couldn't be rendered statically because it used
 * `cookies`" error for each one.
 *
 * None of that access is needed. Reading the catalogue is governed by RLS rules that
 * are the same for every visitor: `active = true` or nothing. There is no per-user
 * rule to evaluate, so there is no session to carry — and a client with no session
 * cannot dirty the cache key, which is what lets these pages stay static.
 *
 * So the public read path is this file, and the session-aware path stays in
 * `server.ts` for the admin, where the session genuinely decides what may be read.
 *
 * ---------------------------------------------------------------------------
 * It is still the anon key
 * ---------------------------------------------------------------------------
 * RLS applies exactly as it does in the browser. This client has *more* power than a
 * browser one in one narrow way — it will not see a user's session, so a signed-in
 * admin viewing the shop sees what a visitor sees — and less in none. It cannot read
 * an inactive product, because the policy says so and policies are enforced by
 * Postgres, not by the client.
 */

const globalForPublic = globalThis as typeof globalThis & {
  __pedigreePublicClient?: SupabaseClient<Database>;
};

export function createPublicClient(): SupabaseClient<Database> {
  const existing = globalForPublic.__pedigreePublicClient;
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.",
    );
  }

  const client = createSupabaseClient<Database>(url, anonKey, {
    auth: {
      /* No session, and none is invented. `persistSession: false` is the important
         one: with it on, this client would try to read a session out of a cookie store
         it does not have, which is exactly the dynamic-rendering trap above. */
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  globalForPublic.__pedigreePublicClient = client;
  return client;
}