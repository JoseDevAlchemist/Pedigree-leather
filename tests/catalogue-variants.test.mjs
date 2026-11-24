import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("exports", "require", outputText)(exports, (id) => imports[id] ?? require(id));
  return exports;
}

test("cart treats two sizes of one colour as independent lines", () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  try {
    const { useCartStore } = load("lib/store/cart.ts");
    const { addItem, removeItem, updateQuantity } = useCartStore.getState();
    const common = { productId: "shoe", colorId: "tan", quantity: 1, stockQuantity: 4 };
    addItem(common);
    addItem({ ...common, sizeId: "size-40" });
    addItem({ ...common, sizeId: "size-42" });
    addItem({ ...common, sizeId: "size-42" });
    updateQuantity("shoe", "tan", 3, "size-40");
    removeItem("shoe", "tan", "size-42");
    assert.deepEqual(useCartStore.getState().items.map(({ sizeId, quantity }) => [sizeId, quantity]), [
      [undefined, 1], ["size-40", 3],
    ]);
  } finally {
    delete globalThis.localStorage;
  }
});

test("unphotographed products render a labelled colour placeholder and accept a real image", () => {
  const { ProductImage } = load("components/product/ProductImage.tsx", {
    "@/lib/angles": load("lib/angles.ts"),
    "@/lib/color": load("lib/color.ts"),
    "@/lib/product-image-url": load("lib/product-image-url.ts"),
    "next/image": { default: ({ src, alt }) => createElement("img", { src, alt }) },
  });
  const product = { productName: "Fixture shoe", colorName: "Tan", hex: "#804000", angle: "front" };
  const placeholder = renderToStaticMarkup(createElement(ProductImage, { ...product, src: null }));
  assert.match(placeholder, /role="img"/);
  assert.match(placeholder, /aria-label="Fixture shoe in Tan. Photo unavailable."/);
  assert.match(placeholder, />Tan</);
  assert.doesNotMatch(placeholder, /<img/);
  const src = "https://fixture.supabase.co/storage/v1/object/public/product-images/shoe.jpg";
  const photo = renderToStaticMarkup(createElement(ProductImage, { ...product, src }));
  assert.match(photo, /<img src="https:\/\/fixture\.supabase\.co\/.*\/shoe\.jpg"/);
  assert.doesNotMatch(photo, /Photo unavailable/);
});
