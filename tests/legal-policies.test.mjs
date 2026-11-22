import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();

function load(file) {
  if (modules.has(file)) return modules.get(file);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  new Function("exports", "require", outputText)(exports, id => {
    if (id === "next/link") {
      return function TestLink({ children, ...props }) {
        return createElement("a", props, children);
      };
    }
    if (id === "next/navigation") return { notFound: () => assert.fail("Unexpected missing legal page") };
    if (id === "@/lib/supabase/public") return { createPublicClient: () => assert.fail("Approved policies must render without a database read") };
    const base = id.startsWith("@/") ? join(root, id.slice(2)) : resolve(dirname(file), id);
    const local = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(existsSync);
    return local ? load(local) : require(id);
  });
  modules.set(file, exports);
  return exports;
}

const source = readFileSync(join(root, "content/legal/terms-source.md"), "utf8");
const policies = load(join(root, "content/legal/index.ts"));
const route = load(join(root, "app/(shop)/legal/[slug]/page.tsx"));
const render = async slug => renderToStaticMarkup(await route.default({ params: Promise.resolve({ slug }) }));
const normalise = text => text.replace(/\s+/g, " ").trim();
const plainMarkdown = text => normalise(text.replace(/^(?:#{1,3} |- |---$)/gm, "").replace(/\*/g, ""));
const plainHtml = text => normalise(text.replace(/<(?:\/p|\/h[1-3]|\/li|br\/?)[^>]*>/g, " ").replace(/<[^>]+>/g, "")
  .replace(/&(?:amp|lt|gt|quot|#x27);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" })[entity]));

test("the typed policy modules preserve the supplied Markdown verbatim", () => {
  const sections = policies.legalSections;
  const reconstructed = [
    `# ${policies.termsTitle}`, policies.termsIntroduction,
    ...sections.map(section => `## ${section.title}\n\n${section.content}`), "---", policies.termsClosing,
  ].join("\n\n");
  assert.equal(reconstructed, source.replace(/\r\n/g, "\n").trim());
  assert.deepEqual(sections.map(section => section.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("the terms route renders every policy once, with semantic formatting and working anchors", async () => {
  const html = await render("terms");
  const approvedContent = html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/g, "").replace(/<p[^>]*><a[^>]*>Contact customer support<\/a><\/p>/, "");
  assert.equal(plainHtml(approvedContent), plainMarkdown(source));
  assert.match(html, /<strong>Effective date:<\/strong> 22 November 2026/);
  assert.match(html, /<h3>9\.7 Website cookies and essential technology<\/h3>/);
  assert.match(html, /<ul><li><strong>Footwear:<\/strong>/);
  for (const { id } of policies.legalSections) {
    assert.equal(html.split(`id="${id}"`).length, 2);
    assert.match(html, new RegExp(`href="#${id}"`));
  }
  assert.match(html, /href="\/contact"/);
});

test("related policy pages render the same approved sections", async () => {
  for (const [slug, page] of Object.entries(policies.legalPages)) {
    if (slug === "terms") continue;
    const html = await render(slug);
    const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)];
    assert.deepEqual(sections.map(match => plainHtml(match[1])),
      page.sections.map(section => plainMarkdown(`${section.title}\n\n${section.content}`)));
  }
});

test("policy markdown renders HTML-like input as escaped text", () => {
  const { LegalMarkdown } = load(join(root, "components/legal/LegalMarkdown.tsx"));
  const html = renderToStaticMarkup(createElement(LegalMarkdown, { content: "<script>alert(1)</script>" }));
  assert.equal(html, "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
});
