import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

import { legalPolicyCacheTag, storefrontCache, type StorefrontCacheScope } from "@/lib/storefront-cache";

type ClientScope = StorefrontCacheScope | "fresh";

// A scoped client only shares approved anonymous PostgREST reads.
const clients = new Map<ClientScope, SupabaseClient<Database>>();

function publicFetch(url: string, anonKey: string, scope: ClientScope): typeof fetch {
  const origin = new URL(url).origin;

  return (input, init) => {
    const request = input instanceof Request ? input : null;
    const target = new URL(request?.url ?? String(input));
    const headers = new Headers(init?.headers ?? request?.headers);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const rule = scope === "fresh" ? null : storefrontCache[scope];
    const query = target.searchParams;
    const projection = query.get("select");
    const slug = query.get("slug");
    const safeSlug = slug && /^eq\.[a-z-]{1,60}$/.test(slug) ? slug.slice(3) : null;

    const publicRead = rule && method === "GET" && target.origin === origin &&
      target.pathname === `/rest/v1/${rule.table}` &&
      !headers.has("cookie") && headers.get("authorization") === `Bearer ${anonKey}` &&
      headers.get("apikey") === anonKey && projection && !projection.includes("*") &&
      (scope !== "catalogue" || (query.get("active") === "eq.true" && query.get("is_website_published") === "eq.true")) &&
      (scope !== "categories" || query.get("is_active") === "eq.true") &&
      (scope !== "settings" || query.get("id") === "eq.default") &&
      (scope !== "legal" || (safeSlug && query.get("published_at") === "not.is.null"));

    if (!publicRead) return fetch(input, { ...init, cache: "no-store", next: undefined });

    return fetch(input, {
      ...init,
      cache: "force-cache",
      next: {
        revalidate: rule.revalidate,
        tags: scope === "legal" && safeSlug ? [rule.tag, legalPolicyCacheTag(safeSlug)] : [rule.tag],
      },
    });
  };
}

export function createPublicClient(scope: ClientScope = "fresh"): SupabaseClient<Database> {
  const existing = clients.get(scope);
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const client = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: publicFetch(url, anonKey, scope) },
  });
  clients.set(scope, client);
  return client;
}
