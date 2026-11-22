import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("exports", "require", outputText)(exports, id => {
    if (["zod", "react", "react/jsx-runtime"].includes(id)) return nativeRequire(id);
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected fixture dependency ${id}`);
    return dependencies[id];
  });
  return exports;
}

const schema = load("lib/settings-schema.ts");
const sections = load("lib/settings-sections.ts");
const cacheRules = load("lib/storefront-cache.ts");
const timestamp = "2026-11-22T19:00:00.001234+00:00";
const savedTimestamp = "2026-11-22T19:01:00.004321+00:00";

function settingsFixture({ role = "owner", version = timestamp, configured = false, rpcError } = {}) {
  const operations = [];
  const client = {
    storage: {
      from: bucket => ({
        async upload(path, file) { operations.push(["upload", bucket, path, file.type]); return { error: null }; },
        async remove(paths) { operations.push(["remove", paths]); return { error: null }; },
      }),
    },
    async rpc(name, args) {
      operations.push(["rpc", name, args]);
      return { data: savedTimestamp, error: rpcError };
    },
  };
  const actions = load("lib/actions/settings.ts", {
    "next/cache": {
      revalidatePath: path => operations.push(["revalidate", path]),
      updateTag: tag => operations.push(["tag", tag]),
    },
    "@/lib/storefront-cache": cacheRules,
    "@/lib/roles": {
      requireRole(expected) {
        assert.equal(expected, "owner");
        if (role !== "owner") throw new Error("redirect");
        return { email: "owner@example.test" };
      },
    },
    "@/lib/notification-settings": { notificationAvailability: () => ({ whatsapp: false, email: false }) },
    "@/lib/payments/config": { isStkConfigured: () => configured },
    "@/lib/supabase/admin": { createAdminClient: () => client },
    "@/lib/supabase/server": { createClient: () => assert.fail("Session mutations are unavailable in this fixture") },
    "@/lib/settings-api": { getShopSettings: () => ({ updated_at: version, exchange_rate_kes_to_usd: 130 }) },
    "@/lib/settings-schema": schema,
    "@/lib/settings-sections": sections,
  });
  return { ...actions, operations };
}

test("only website owners can call settings mutations or invalidate cache", async () => {
  for (const role of ["worker", "manager", "anonymous"]) {
    const fixture = settingsFixture({ role });
    await assert.rejects(fixture.saveSettingsAction("currency", timestamp, { exchange_rate_kes_to_usd: 140 }, new FormData()), /redirect/);
    await assert.rejects(fixture.refreshStorefrontAction(), /redirect/);
    assert.deepEqual(fixture.operations, []);
  }
});

test("saving a rate patches only the shared currency field", async () => {
  const fixture = settingsFixture();
  const result = await fixture.saveSettingsAction("currency", timestamp, { exchange_rate_kes_to_usd: 145.25 }, new FormData());
  assert.equal(result.ok, true);
  assert.equal(result.rateUpdated, savedTimestamp);
  assert.deepEqual(fixture.operations, [
    ["rpc", "save_website_settings", {
      p_actor: "owner@example.test", p_version: timestamp,
      p_core: { exchange_rate_kes_to_usd: 145.25 }, p_preferences: {}, p_private: {}, p_policies: {},
    }],
    ["tag", "storefront:settings"],
  ]);
  const { getDisplayPrices } = load("lib/format.ts");
  assert.equal(getDisplayPrices({ basePrice: 14525, discountPercent: 0, exchangeRate: 145.25 }).usd, "$100.00");
  assert.equal(getDisplayPrices({ basePrice: 14525, discountPercent: 0, exchangeRate: 145.25, basePriceUsd: 149 }).usd, "$149");
});

test("private inventory settings stay out of the storefront patch", async () => {
  const fixture = settingsFixture();
  const result = await fixture.saveSettingsAction("inventory", timestamp, { low_stock_threshold: 4 }, new FormData());
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.operations[0][2].p_private, { low_stock_threshold: 4 });
  assert.deepEqual(fixture.operations[0][2].p_preferences, {});
  assert.deepEqual(fixture.operations[1], ["revalidate", "/admin/products"]);
});

test("invalid, stale or unauthorized settings changes never reach the writer", async () => {
  const fixture = settingsFixture();
  for (const [section, patch] of [
    ["currency", { exchange_rate_kes_to_usd: 0 }],
    ["store", { google_maps_url: "javascript:alert(1)" }],
    ["store", { logo: "logo/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png" }],
    ["store", { exchange_rate_kes_to_usd: 150 }],
    ["payments", { stk_enabled: true }],
  ]) {
    assert.equal((await fixture.saveSettingsAction(section, timestamp, patch, new FormData())).ok, false);
  }
  const stale = settingsFixture({ version: savedTimestamp });
  assert.match((await stale.saveSettingsAction("store", timestamp, { shop_name: "Fixture" }, new FormData())).error, /another session/);
  assert.deepEqual(fixture.operations, []);
  assert.deepEqual(stale.operations, []);
});

test("branding validates the file and cleans up after a database stale-write rejection", async () => {
  const fixture = settingsFixture({ rpcError: { code: "40001" } });
  const uploads = new FormData();
  uploads.set("logo", new File(["Invalid PNG"], "fixture.png", { type: "image/png" }));
  assert.equal((await fixture.saveSettingsAction("store", timestamp, {}, uploads)).ok, false);
  assert.deepEqual(fixture.operations, []);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1sAAAAASUVORK5CYII=", "base64");
  uploads.set("logo", new File([png], "fixture.png", { type: "image/png" }));
  assert.match((await fixture.saveSettingsAction("store", timestamp, {}, uploads)).error, /another session/);
  const [, bucket, path] = fixture.operations[0];
  assert.equal(bucket, "store-branding");
  assert.match(path, /^logo\/[0-9a-f-]+\.png$/);
  assert.equal(fixture.operations[1][2].p_preferences.logo, path);
  assert.deepEqual(fixture.operations[2], ["remove", [path]]);
});

const orderId = "3fe40174-70b4-4ad1-939b-06ea46e68150";

function checkoutFixture({ deliveryEnabled = true, pickupAvailable = true, zones = true, validZone = true, payAtPickup = true } = {}) {
  const orders = [];
  const payments = [];
  const { z } = nativeRequire("zod");
  const builder = {
    eq() { return this; },
    neq() { return this; },
    select() { return this; },
    single() { return { data: { status: "pending_payment", payment_status: "pending", delivery_method: "pickup" } }; },
    update(patch) { payments.push(patch); return this; },
    maybeSingle() { return { data: { id: orderId } }; },
  };
  const actions = load("lib/actions/orders.ts", {
    "next/cache": { updateTag: () => assert.fail("An idempotent retry must not invalidate the catalogue") },
    "@/lib/storefront-cache": cacheRules,
    "@/lib/orders-api": {
      createOrder: async payload => { orders.push(payload); return { created: false, orderId }; },
      getOrderById: async () => assert.fail("No customer notification should run"),
    },
    "@/lib/payments/config": load("lib/payments/config.ts", { "server-only": {} }),
    "@/lib/settings-api": {
      getShopSettings: async () => ({ storefront_preferences: { pay_at_pickup: payAtPickup } }),
      hasActiveDeliveryZones: async () => zones,
      getActiveDeliveryZone: async id => validZone ? { id, name: "Fixture zone", fee: 520 } : null,
    },
    "@/lib/shop-config": { getShopConfig: async () => ({
      deliveryEnabled, pickupAvailable, freeDeliveryThreshold: 10_000, deliveryFlatRate: 300,
    }) },
    "@/lib/validation": { kenyanPhoneSchema: z.string() },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => builder }) },
  });
  return { ...actions, orders, payments };
}

function checkoutForm({ method = "delivery", zoneId, unitPrice = 2000 } = {}) {
  const fields = new FormData();
  for (const [key, value] of Object.entries({
    name: "Fixture customer", phone: "+254700000000", deliveryMethod: method,
    deliveryAddress: "Test address for delivery", requestId: orderId,
    zoneName: "Browser-provided name", deliveryFee: "0",
    cartItems: JSON.stringify([{ productId: orderId, colorId: orderId, unitPrice, quantity: 1 }]),
  })) fields.set(key, value);
  if (zoneId) fields.set("zoneId", zoneId);
  return fields;
}

test("checkout rejects disabled fulfilment methods and requires an active configured zone", async () => {
  const deliveryOff = checkoutFixture({ deliveryEnabled: false });
  const pickupOff = checkoutFixture({ pickupAvailable: false });
  const invalidZone = checkoutFixture({ validZone: false });
  assert.match((await deliveryOff.createOrderAction(checkoutForm())).error, /Delivery is currently unavailable/);
  assert.match((await pickupOff.createOrderAction(checkoutForm({ method: "pickup" }))).error, /pickup is currently unavailable/);
  assert.match((await invalidZone.createOrderAction(checkoutForm())).error, /select an available delivery zone/);
  assert.match((await invalidZone.createOrderAction(checkoutForm({ zoneId: orderId, unitPrice: 10000 }))).error, /no longer available/);
  assert.deepEqual([...deliveryOff.orders, ...pickupOff.orders, ...invalidZone.orders], []);
});

test("checkout charges the database zone fee, respects the threshold and strips pickup zone IDs", async () => {
  const fixture = checkoutFixture();
  for (const params of [{ zoneId: orderId }, { zoneId: orderId, unitPrice: 10000 }, { method: "pickup", zoneId: orderId }]) {
    assert.equal((await fixture.createOrderAction(checkoutForm(params))).ok, true);
  }
  assert.deepEqual(fixture.orders.map(order => [order.deliveryFee, order.zoneName, order.zoneId]), [
    [520, "Fixture zone", orderId], [0, "Fixture zone", orderId], [0, null, null],
  ]);
});

test("guest callers cannot use the removed demo card flow to settle an order", async () => {
  const fixture = checkoutFixture();
  assert.equal((await fixture.markPaymentMethodAction(orderId, "card", { markPaid: true })).ok, false);
  assert.deepEqual(fixture.payments, []);
  assert.equal((await fixture.markPaymentMethodAction(orderId, "mpesa_manual", { reference: "TEST1234" })).ok, true);
  assert.deepEqual(fixture.payments, [{
    payment_method: "mpesa_manual", payment_status: "pending", payment_reference: "TEST1234",
    paid_at: null, checkout_request_id: null,
  }]);
});

test("settings render labelled inputs and the shared currency preview", () => {
  const { createElement } = nativeRequire("react");
  const { renderToStaticMarkup } = nativeRequire("react-dom/server");
  const { AdminSettings } = load("components/admin/AdminSettings.tsx", {
    "@/hooks/useUnsavedSettings": { useUnsavedSettings() {} },
    "@/lib/format": load("lib/format.ts"),
    "@/lib/actions/settings": { saveSettingsAction: () => assert.fail("Rendering must not save anything") },
    "@/lib/settings-sections": sections,
  });
  const html = renderToStaticMarkup(createElement(AdminSettings, {
    section: "currency", initialVersion: timestamp, rateUpdated: timestamp,
    initialValues: { exchange_rate_kes_to_usd: 125 },
  }));
  assert.match(html, /<fieldset[^>]*><legend[^>]*>Exchange rate<\/legend>/);
  assert.match(html, /<label[^>]*>KES per 1 USD<input[^>]*value="125"/);
  assert.match(html, /KES 10,000 converts to \$80\.00/);
  assert.match(html, /type="submit" disabled=""[^>]*>Save changes/);
});

test("configured WhatsApp preferences use only selected fixtures without calling live Twilio", async () => {
  const restore = Object.fromEntries(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"].map(key => [key, process.env[key]]));
  process.env.TWILIO_ACCOUNT_SID = "fixture";
  process.env.TWILIO_AUTH_TOKEN = "fixture";
  const calls = [];
  let preferences = {
    notify_new_order: true,
    notify_customer_status: false,
    notify_customer_cancellation: false,
    notification_phones: "+254700000001, +254700000002, +254700000001",
  };
  try {
    const { notifyShopOwner, notifyStatusChange, sendWhatsApp } = load("lib/whatsapp.ts", {
      "server-only": {},
      twilio: { default: () => ({ messages: { create: message => calls.push(message) } }) },
      "@/lib/notification-settings": { getNotificationSettings: async () => preferences },
    });
    const order = {
      order_number: "FIXTURE", customer_name: "Fixture customer", customer_phone: "+254700000000",
      total: 1300, delivery_method: "pickup", status: "cancelled", items: [],
    };
    await notifyShopOwner(order);
    await notifyStatusChange(order);
    preferences = null;
    await notifyShopOwner(order);
    assert.deepEqual(calls.map(({ to }) => to), ["whatsapp:+254700000001", "whatsapp:+254700000002"]);
    assert.equal(typeof sendWhatsApp, "function");
  } finally {
    for (const [key, value] of Object.entries(restore)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("pickup payment preferences are enforced by the guest payment action", async () => {
  const disabled = checkoutFixture({ payAtPickup: false });
  assert.match((await disabled.markPaymentMethodAction(orderId, "pay_on_delivery")).error, /unavailable/);
  assert.deepEqual(disabled.payments, []);

  const enabled = checkoutFixture();
  assert.equal((await enabled.markPaymentMethodAction(orderId, "pay_on_delivery")).ok, true);
  assert.equal(enabled.payments[0].payment_status, "pending");
});
