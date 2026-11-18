import assert from "node:assert/strict";
import test from "node:test";

const origin = "https://catalogue.example.supabase.co";
const configuredOrigin = "https://configured.example.supabase.co";
const originalPath = "/storage/v1/object/public/";
const legacyPath = "/storage/v1/render/image/public/";
const suffix = "?v=173&tag=a%2Bb&tag=two#preview";
const key = "product-images/product-id/Tan%20%23%3F%25";

const savedOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = configuredOrigin + "/";
const { originalProductImageUrl } = await import("../lib/product-image-url.ts");
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
const { originalProductImageUrl: withoutConfiguredOrigin } = await import(
  "../lib/product-image-url.ts?without-configured-origin"
);
if (savedOrigin !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedOrigin;

for (const extension of ["webp", "jpg", "png"]) {
  test(`keeps a public ${extension} object URL byte-for-byte`, () => {
    const src = origin + originalPath + key + "." + extension + suffix;
    assert.equal(originalProductImageUrl(src), src);
  });

  test(`maps a legacy ${extension} transform to its original public object`, () => {
    const objectKey = key + "." + extension + suffix;
    const src = origin + legacyPath + objectKey;
    const expected = origin + originalPath + objectKey;
    assert.equal(originalProductImageUrl(src), expected);
    assert.equal(withoutConfiguredOrigin(src), expected);
  });
}

test("resolves stored bucket-relative sources against the configured project", () => {
  const relative = key + ".webp" + suffix;
  const expected = configuredOrigin + originalPath + relative;
  for (const src of [relative, originalPath.slice(1) + relative, legacyPath.slice(1) + relative]) {
    assert.equal(originalProductImageUrl(src), expected);
    assert.equal(withoutConfiguredOrigin(src), src);
  }
});

test("keeps local assets, previews and unrelated URLs intact", () => {
  const sources = [
    "/pedigree-logo.png",
    "blob:https://store.example/upload",
    "data:image/webp;base64,AAAA",
    "https://cdn.example/photo.jpg?next=/storage/v1/render/image/public/photo.jpg",
    "https://cdn.example/prefix/storage/v1/render/image/public/photo.jpg",
  ];
  for (const src of sources) assert.equal(originalProductImageUrl(src), src);
});
