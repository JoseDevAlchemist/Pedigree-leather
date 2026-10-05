/**
 * ============================================================================
 * NEVER import this file from a client component.
 * ============================================================================
 *
 * This module reads `SUPABASE_SERVICE_ROLE_KEY`, which bypasses Row Level
 * Security entirely. Anything built with this client can read and write every
 * row in the database — including `products.active = false`, which the public
 * policies deliberately hide — regardless of who is asking.
 *
 * The key is not `NEXT_PUBLIC_`-prefixed, so Next.js will not inline it into the
 * client bundle. But "the bundler will not do it" is not the same as "it cannot
 * happen": a stray `import` in a `"use client"` file is all it takes, and the
 * failure mode is a leaked credential rather than a broken build. So the
 * invariant is enforced as well as documented:
 *
 *   - `import "server-only"` at the top makes any client-side import a build
 *     error rather than a silent leak.
 *   - Every function here throws if it finds itself running without
 *     `window` — a runtime backstop for the case where the build step is bypassed.
 *   - `lib/admin-api.ts` is the only thing in this repo that imports this file,
 *     and it is server-only for the same reason.
 *
 * Use this for work that genuinely needs to bypass RLS: the admin product table
 * lists inactive products, deletes cascade, and the dashboard counts sold-out
 * rows. Customer-facing reads must use `lib/supabase/server.ts` instead, so the
 * shop's own policies stay in force.
 */

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * The service-role client. Memoised on `globalThis` for the same reason as the
 * browser client: in development the module graph is re-evaluated often, and a new
 * client per evaluation leaks connection pools under load.
 */
const globalForAdmin = globalThis as typeof globalThis & {
  __pedigreeAdminClient?: SupabaseClient<Database>;
};

function assertServer() {
  /* `server-only` already refuses the import. This catches the case where the
     module is bundled anyway — a test runner without the alias, or a bundler
     misconfiguration — and turns a leaked key into an immediate, loud failure. */
  if (typeof window !== "undefined") {
    throw new Error(
      "lib/supabase/admin.ts was imported in the browser. It holds the service role key and must stay on the server.",
    );
  }
}

export function createAdminClient(): SupabaseClient<Database> {
  assertServer();

  const existing = globalForAdmin.__pedigreeAdminClient;
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill both in.",
    );
  }

  /* No session persistence and no auto-refresh. This client represents the
     application, not a person, so there is no user to refresh a token for. */
  const client = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  globalForAdmin.__pedigreeAdminClient = client;
  return client;
}