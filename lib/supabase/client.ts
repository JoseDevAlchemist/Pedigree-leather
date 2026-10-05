import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * The one place the browser Supabase client is created.
 *
 * The client is memoised on `globalThis`, not on a module variable. That is not a
 * micro-optimisation: React remounts components and re-evaluates modules on hot
 * reload and on fast refresh, and a fresh `SupabaseClient` per mount is what
 * produces the "Multiple GoTrueClient instances" warning — and, worse, two
 * independent auth states in one tab where one signs you in and the other does
 * not notice. One client per browser context, forever.
 *
 * This client runs under the **anon** key, so RLS applies to it: it may read
 * active products and upload into the storage bucket as an authenticated user,
 * and nothing else. It must never see the service role key.
 */

const globalForSupabase = globalThis as typeof globalThis & {
  __pedigreeSupabase?: SupabaseClient<Database>;
};

/** Test seam. Lets a test install a stub instead of opening a real connection. */
export function setBrowserClientForTests(client: SupabaseClient<Database> | undefined) {
  globalForSupabase.__pedigreeSupabase = client;
}

export function createClient(): SupabaseClient<Database> {
  const existing = globalForSupabase.__pedigreeSupabase;
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.",
    );
  }

  const client = createBrowserClient<Database>(url, anonKey);
  if (process.env.NODE_ENV !== "production") {
    globalForSupabase.__pedigreeSupabase = client;
  }

  return client;
}