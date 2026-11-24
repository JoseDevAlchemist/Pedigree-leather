import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createPatchedFetcher } from "next/dist/server/lib/patch-fetch.js";
import { AsyncLocalStorage } from "node:async_hooks";

function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const require = createRequire(import.meta.url);
  new Function("exports", "require", outputText)(exports, id => dependencies[id] ?? require(id));
  return exports;
}

const rules = load("lib/storefront-cache.ts");
const fixtureUrl = "https://cache-fixture.example";
const anonKey = "fixture-anonymous-key";
const publicHeaders = { apikey: anonKey, authorization: `Bearer ${anonKey}` };

test("the scoped transport defaults to no-store for private, unfiltered and credentialed requests", async () => {
  const received = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    received.push({ input, ...init });
    return Response.json([]);
  };
  const { createPublicClient } = load("lib/supabase/public.ts", {
    "server-only": {},
    "@/lib/storefront-cache": rules,
    "@supabase/supabase-js": { createClient: (_url, _key, options) => options.global.fetch },
  });
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixtureUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  try {
    const catalogue = createPublicClient("catalogue");
    const published = `${fixtureUrl}/rest/v1/products?select=id,slug&active=eq.true&is_website_published=eq.true`;
    await catalogue(published, { headers: publicHeaders });
    assert.equal(received[0].cache, "force-cache");
    assert.deepEqual(received[0].next, { revalidate: 30, tags: ["storefront:catalogue"] });

    await catalogue(published.replace("&is_website_published=eq.true", ""), { headers: publicHeaders });
    await catalogue(published.replace("id,slug", "*"), { headers: publicHeaders });
    await catalogue(published, { headers: { ...publicHeaders, cookie: "session=fixture" } });
    await catalogue(published, { headers: { ...publicHeaders, authorization: "Bearer fixture-user" } });
    await catalogue(published, { headers: publicHeaders, method: "POST" });
    await catalogue(published.replace("/products?", "/orders?"), { headers: publicHeaders });
    await createPublicClient()(`${fixtureUrl}/rest/v1/shop_settings?select=id&id=eq.default`, { headers: publicHeaders });
    assert.ok(received.slice(1).every(request => request.cache === "no-store" && !request.next));

    await createPublicClient("legal")(`${fixtureUrl}/rest/v1/legal_pages?select=title,content&slug=eq.privacy&published_at=not.is.null`, { headers: publicHeaders });
    assert.deepEqual(received.at(-1).next, { revalidate: 120, tags: ["storefront:legal", "storefront:legal:privacy"] });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("Next fetch shares repeated catalogue queries without merging filters, pages or currencies", async t => {
  const requests = [];
  const storage = new Map();
  const workAsyncStorage = new AsyncLocalStorage();
  const workUnitAsyncStorage = new AsyncLocalStorage();
  const nextFetch = createPatchedFetcher(async (url) => {
    requests.push(String(url));
    return Response.json(Array.from({ length: 240 }, (_, index) => ({
      id: `fixture-${index}`, name: `Published product ${index}`,
    })));
  }, { workAsyncStorage, workUnitAsyncStorage });
  const incrementalCache = {
    async generateCacheKey(url) { return url; },
    async lock() { return async () => {}; },
    async get(key) { return storage.get(key) ?? null; },
    async set(key, value, context) { storage.set(key, { value, isStale: false, tags: context.tags }); },
  };
  const run = async (path, options) => {
    const work = { route: "/", incrementalCache, shouldTrackFetchMetrics: true };
    const body = await workAsyncStorage.run(work, async () => {
      const response = await nextFetch(fixtureUrl + path, options);
      return response.json();
    });
    await Promise.all(Object.values(work.pendingRevalidates ?? {}));
    return { body, status: work.fetchMetrics?.at(-1)?.cacheStatus };
  };

  const routes = [
    ["Home", ""],
    ["Bags", "&category=eq.bag"],
    ["Shoes", "&category=eq.shoe"],
    ["Search", "&name=ilike.*tote*"],
    ["Detail", "&slug=eq.fixture-tote&limit=1"],
  ].map(([label, suffix]) => [label, `/rest/v1/products?select=id,name&active=eq.true&is_website_published=eq.true${suffix}`]);
  const old = { headers: publicHeaders, cache: "no-store" };
  const tuned = { headers: publicHeaders, cache: "force-cache", next: { revalidate: 30, tags: ["storefront:catalogue"] } };
  for (const [label, path] of routes) {
    const before = requests.length;
    await run(path, old);
    await run(path, old);
    const baseline = requests.length - before;
    const cold = await run(path, tuned);
    const warm = await run(path, tuned);
    assert.equal(cold.body.length, 240);
    assert.equal(warm.status, "hit");
    assert.equal(baseline, 2);
    assert.equal(requests.length - before - baseline, 1);
    t.diagnostic(`${label}: catalogue origin requests for two equivalent reads 2 → 1 (warm HIT)`);
  }

  const [, home] = routes[0];
  const start = requests.length;
  for (const suffix of ["&base_price=gte.500", "&offset=240", "&base_price_usd=gte.40"]) {
    await run(home + suffix, tuned);
  }
  assert.equal(requests.length - start, 3);

  for (const [key, entry] of storage) {
    if (entry.tags.includes("storefront:catalogue")) storage.delete(key);
  }
  const beforeRefresh = requests.length;
  await run(home, tuned);
  assert.equal(requests.length, beforeRefresh + 1);
  assert.equal((await run(home, tuned)).status, "hit");
});

test("public product changes expire the catalogue after the database write", async () => {
  const events = [];
  const passSchema = { safeParse: data => ({ success: true, data }) };
  const actions = load("lib/actions/products.ts", {
    "@/lib/storefront-cache": rules,
    "next/cache": {
      updateTag: tag => events.push(["tag", tag]),
      revalidatePath: path => events.push(["path", path]),
    },
    "@/lib/supabase/guards": { requireAdminUser: async () => {}, requireAdminRole: async () => {} },
    "@/lib/validation": {
      productInputSchema: passSchema,
      productEditSchema: passSchema,
      quickFieldEditSchema: { safeParse: ({ field, value }) => ({ success: true, data: { field, value } }) },
    },
    "@/lib/admin-api": {
      createProduct: async () => events.push(["write", "create"]),
      updateProduct: async () => events.push(["write", "update"]),
      deleteProduct: async () => events.push(["write", "delete"]),
      updateProductField: async (_id, field) => events.push(["write", field]),
    },
  });
  const id = "00000000-0000-4000-8000-000000000001";
  for (const [name, action] of [
    ["create", () => actions.createProductAction({}, id)],
    ["update", () => actions.updateProductAction(id, { slug: "updated", category: "belt" })],
    ["active", () => actions.updateFieldAction(id, "active", false)],
    ["discount_percent", () => actions.updateFieldAction(id, "discount_percent", 15)],
    ["delete", () => actions.deleteProductAction(id)],
  ]) {
    events.length = 0;
    assert.equal((await action()).ok, true);
    assert.deepEqual(events.slice(0, 3), [
      ["write", name], ["tag", "storefront:catalogue"], ["path", "/sitemap.xml"],
    ]);
  }
});
