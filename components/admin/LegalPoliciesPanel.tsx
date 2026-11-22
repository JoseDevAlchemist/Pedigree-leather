import Link from "next/link";
import { LegalPolicyEditor } from "@/components/admin/LegalPolicyEditor";
import { getLegalBaseline, legalPages } from "@/content/legal";
import { legalPolicyState } from "@/lib/legal-policy-state";
import { createAdminClient } from "@/lib/supabase/admin";

async function loadPolicy(owner: string, slug: string) {
  try {
    const { data, error } = await createAdminClient().rpc("read_legal_policy_editor", { p_actor: owner, p_slug: slug });
    const state = legalPolicyState.safeParse(data);
    return !error && state.success ? state.data : null;
  } catch {
    return null;
  }
}

export async function LegalPoliciesPanel({ owner, policy }: { owner: string; policy: string | string[] | undefined }) {
  const requested = typeof policy === "string" ? policy : "terms";
  const baseline = getLegalBaseline(requested);
  const slug = baseline ? requested : "terms";
  const content = baseline ?? getLegalBaseline("terms")!;
  const state = await loadPolicy(owner, slug);

  return (
    <section aria-labelledby="legal-policies" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 id="legal-policies" className="font-serif text-2xl font-semibold">Legal policies</h3>
      <nav aria-label="Choose a legal policy" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {Object.entries(legalPages).map(([id, page]) => (
          <Link key={id} href={`/admin/settings?section=orders&policy=${id}#legal-policies`} prefetch={false}
            aria-current={id === slug ? "page" : undefined} className="underline underline-offset-4 aria-[current=page]:font-semibold">
            {page.label}
          </Link>
        ))}
      </nav>
      {state ? <LegalPolicyEditor key={slug} slug={slug} baseline={content} initial={state} />
        : <p role="alert" className="text-sm text-red-800">The policy editor is unavailable. Check that the legal workflow migration is installed.</p>}
    </section>
  );
}
