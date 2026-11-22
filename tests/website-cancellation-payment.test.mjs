import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

test("a retried M-Pesa confirmation records payment without reopening a cancelled order", async () => {
  const order = {
    id: "fixture-order", checkout_request_id: "fixture-attempt",
    status: "pending_payment", payment_status: "pending",
  };
  const patches = [];
  let historyWrites = 0;

  const client = createClient("https://fixture.example", "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options = {}) => {
        const url = new URL(input);
        if (url.pathname.endsWith("/order_status_history")) {
          historyWrites++;
          return Response.json([]);
        }
        if (options.method === "PATCH") {
          assert.equal(url.searchParams.get("checkout_request_id"), "eq.fixture-attempt");
          assert.deepEqual(url.searchParams.getAll("payment_status"), ["neq.paid", "neq.refunded"]);
          const patch = JSON.parse(options.body);
          patches.push(patch);
          // Simulate cancellation committing after the callback's lookup. The
          // real terminal-status trigger is exercised in the PostgreSQL fixture.
          Object.assign(order, patch, { status: "cancelled" });
        }
        return Response.json([{ ...order }]);
      },
    },
  });

  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../app/api/mpesa/callback/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  );
  const route = {};
  const modules = {
    "next/server": { NextResponse: Response },
    "@/lib/supabase/admin": { createAdminClient: () => client },
    "@/lib/orders-api": { getOrderById: async () => null },
    "@/lib/emails/sendReceipt": { sendReceiptEmail: async () => assert.fail("No fixture email should be sent") },
  };
  new Function("exports", "require", outputText)(route, (id) => {
    assert.ok(Object.hasOwn(modules, id), "Only fixture dependencies should load");
    return modules[id];
  });
  function confirmation() {
    return new Request("http://fixture.example/api/mpesa/callback", {
      method: "POST",
      body: JSON.stringify({ Body: { stkCallback: {
        CheckoutRequestID: "fixture-attempt", ResultCode: 0,
        CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "FIXTURE" }] },
      } } }),
    });
  }

  assert.equal((await route.POST(confirmation())).status, 200);
  assert.equal((await (await route.POST(confirmation())).json()).ResultDesc, "Already processed");
  assert.equal(patches.length, 1);
  assert.equal(order.status, "cancelled");
  assert.equal(order.payment_reference, "FIXTURE");
  assert.equal(historyWrites, 0);
});
