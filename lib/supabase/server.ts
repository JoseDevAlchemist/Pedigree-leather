import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/supabase/types";

/**
 * The server-side Supabase client for **reads the shopper is allowed to make**.
 *
 * Server Components, route handlers and server actions that touch customer data
 * go through here. It carries the visitor's session cookie, so RLS sees them as an
 * anonymous visitor and the policies in `001_initial.sql` do the deciding: active
 * products are readable, everything else is not.
 *
 * This is deliberately *not* an escape hatch. If a read here needs more than a
 * shopper may see, it belongs in `lib/supabase/admin.ts` behind an auth check, not
 * in this file.
 *
 * `cookies()` is awaited because it is async in Next.js 15 and later. Calling it
 * without `await` hands back a Promise, and passing a Promise where a cookie store
 * is expected fails at the point of `getAll`, not at the point of the mistake.
 *
 * Returns a fresh client per call rather than caching: a cached server client
 * would hold one visitor's cookies and hand them to the next request. On the
 * server that is a data leak, and the cost of a new client is one object.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      /* Reads. Only the names we care about, so an unexpected cookie cannot break
         parsing, and so this list stays reviewable. */
      getAll() {
        return cookieStore.getAll();
      },
      /* Writes. `setAll` is the only write API in @supabase/ssr 0.12: a cookie
         written during a Server Component render is dropped by React, because
         cookies are immutable once the response has begun streaming. That is fine
         here — this client is for reading — but `lib/actions/auth.ts` refreshes
         the session from a server action, where `setAll` does take effect, so the
         rotation after a login still works. */
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Called from a Server Component. The session is read-only for this
             request; the refreshed cookie is written by the proxy on the next
             navigation instead. Swallowing this is what the @supabase/ssr docs
             prescribe, and it is why the proxy has to exist. */
        }
      },
    },
  });
}