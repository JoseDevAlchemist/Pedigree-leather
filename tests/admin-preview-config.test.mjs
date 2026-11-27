import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server.js";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);
const exports = {};
const require = createRequire(import.meta.url);
let clientCalls = 0;
new Function("exports", "require", outputText)(exports, (id) => {
  if (id !== "@supabase/ssr") return require(id);
  return {
    createServerClient: () => {
      clientCalls++;
      return { auth: { getUser: async () => ({ data: { user: null } }) } };
    },
  };
});

test("admin fails closed without database configuration and redirects signed-out users when configured", async () => {
  const configuration = {
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.example",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  };
  const saved = Object.fromEntries(Object.keys(configuration).map((key) => [key, process.env[key]]));
  const request = (path) => new NextRequest(`https://preview.example${path}`);
  try {
    for (const key of Object.keys(configuration)) {
      Object.assign(process.env, configuration, { [key]: " " });
      const page = await exports.proxy(request("/admin/settings"));
      assert.equal(page.status, 503);
      assert.equal(page.headers.get("cache-control"), "no-store");
      assert.match(await page.text(), /database connection is not configured/);

      const api = await exports.proxy(request("/api/admin/orders"));
      assert.equal(api.status, 503);
      assert.match((await api.json()).error, /database connection is not configured/);
      assert.equal(clientCalls, 0);
    }

    Object.assign(process.env, configuration);
    const signedOut = await exports.proxy(request("/admin/settings"));
    const location = new URL(signedOut.headers.get("location"));
    assert.equal(signedOut.status, 307);
    assert.equal(location.pathname, "/admin/login");
    assert.equal(location.searchParams.get("next"), "/admin/settings");
    assert.equal(clientCalls, 1);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
