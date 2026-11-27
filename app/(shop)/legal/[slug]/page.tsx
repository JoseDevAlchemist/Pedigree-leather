import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { effectiveDate, getLegalPage, legalPages, termsClosing, termsIntroduction } from "@/content/legal";
import { createPublicClient } from "@/lib/supabase/public";

type Props = { params: Promise<{ slug: string }> };

// Migration 023 seeded these bodies before the publication workflow existed.
const legacyPlaceholderTitles: Readonly<Record<string, string>> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  returns: "Returns Policy",
};

const getPublishedPolicy = cache(async (slug: string) => {
  try {
    const { data, error } = await createPublicClient("legal").from("legal_pages")
      .select("title, content").eq("slug", slug).not("published_at", "is", null).maybeSingle();
    if (error || !data?.content.trim()) return null;

    const legacyTitle = Object.hasOwn(legacyPlaceholderTitles, slug) && legacyPlaceholderTitles[slug];
    const placeholder = `This is a placeholder ${legacyTitle} for Pedigree Leather. Update this via the database.`;
    return legacyTitle && data.content.trim() === placeholder ? null : data;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = getLegalPage(slug);
  if (policy) {
    const title = (await getPublishedPolicy(slug))?.title ?? policy.title;
    return { title: slug === "terms" ? { absolute: title } : title };
  }

  const data = await getPublishedPolicy(slug);
  return { title: data?.title ?? "Legal" };
}

function splitPublishedPolicy(content: string, policy: NonNullable<ReturnType<typeof getLegalPage>>) {
  const [introduction, ...blocks] = content.replace(/\r\n/g, "\n").split(/(?=^## )/m);
  const sections = blocks.map((block, index) => {
    const [heading, ...body] = block.split("\n");
    const title = heading.slice(3).trim();
    const fallback = policy.sections.find(section => section.title === title);
    const id = fallback && blocks.findIndex(entry => entry.split("\n")[0].slice(3).trim() === title) === index
      ? fallback.id : `published-section-${index + 1}`;
    return { id, title, content: body.join("\n") };
  });
  return { introduction, sections };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const policy = getLegalPage(slug);

  if (!policy) {
    const data = await getPublishedPolicy(slug);
    if (!data) notFound();
    return <LegalDocument title={data.title}><p className="whitespace-pre-wrap">{data.content}</p></LegalDocument>;
  }

  const published = await getPublishedPolicy(slug);
  const isTerms = slug === "terms";
  const document = published ? splitPublishedPolicy(published.content, policy) : null;
  const sections = document?.sections ?? policy.sections;
  return (
    <LegalDocument title={published?.title ?? policy.title}>
      <nav aria-label="Legal policies" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm">
        {Object.entries(legalPages).map(([id, page]) => (
          <Link key={id} href={`/legal/${id}`} aria-current={id === slug ? "page" : undefined}
            className="underline underline-offset-4 aria-[current=page]:font-semibold">
            {page.label}
          </Link>
        ))}
      </nav>
      {document ? <LegalMarkdown content={document.introduction} />
        : isTerms ? <LegalMarkdown content={termsIntroduction} />
        : <p><strong>Effective date:</strong> {effectiveDate}</p>}
      {isTerms && sections.length > 0 && (
        <nav aria-label="On this page" className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <p className="font-semibold">On this page</p>
          <ol className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {sections.map(section => (
              <li key={section.id}><a className="underline underline-offset-4" href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>
      )}
      {sections.map(section => (
        <section key={section.id} className="space-y-4" aria-labelledby={section.id}>
          <h2 id={section.id} className="scroll-mt-28 pt-3 font-serif text-2xl font-semibold sm:text-3xl">{section.title}</h2>
          <LegalMarkdown content={section.content} />
        </section>
      ))}
      {isTerms && !document && <div className="border-t border-border pt-4"><LegalMarkdown content={termsClosing} /></div>}
      <p className="border-t border-border pt-4">
        <Link href="/contact" className="font-semibold text-primary underline underline-offset-4">Contact customer support</Link>
      </p>
    </LegalDocument>
  );
}

function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-8 md:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h1>
      <article className="mt-8 space-y-5 leading-relaxed [&_h2]:pt-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </article>
    </main>
  );
}
