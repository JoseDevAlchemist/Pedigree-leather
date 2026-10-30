import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPublicClient } from "@/lib/supabase/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase.from("legal_pages").select("title").eq("slug", slug).maybeSingle();
  return { title: data?.title ?? "Legal" };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("legal_pages")
    .select("slug, title, content")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) notFound();

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 md:px-8">
      <header>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {data.title}
        </h1>
      </header>
      <article className="prose prose-neutral mt-8 max-w-none">
        <p>{data.content}</p>
      </article>
    </main>
  );
}
