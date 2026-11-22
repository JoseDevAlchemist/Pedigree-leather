"use server";

import { legalPolicyCacheTag } from "@/lib/storefront-cache";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getLegalBaseline, getLegalPage } from "@/content/legal";
import { legalPolicyState } from "@/lib/legal-policy-state";
import { requireRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const actionRequest = z.object({
  slug: z.string(),
  action: z.enum(["draft", "publish", "restore"]),
  revision: z.string().regex(/^\d{1,19}$/).nullable(),
  content: z.string().max(30000).nullable(),
});

export async function saveLegalPolicy(request: unknown) {
  const owner = await requireRole("owner");
  const parsed = actionRequest.safeParse(request);
  if (!parsed.success) return { ok: false as const, error: "Enter up to 30,000 characters of Markdown." };
  const { slug, action, revision, content } = parsed.data;
  const policy = getLegalPage(slug);
  const baseline = getLegalBaseline(slug);
  if (!policy || !baseline || (action !== "restore" && !content?.trim())) {
    return { ok: false as const, error: "Choose a policy and enter its text." };
  }

  try {
    const { data, error } = await createAdminClient().rpc("save_legal_policy", {
      p_actor: owner.email,
      p_slug: slug,
      p_title: policy.title,
      p_action: action,
      p_revision: revision,
      p_content: content,
      p_baseline: baseline,
    });
    if (error?.code === "40001") {
      return { ok: false as const, error: "Another edit was saved. Reload the policy before saving again." };
    }
    const state = legalPolicyState.safeParse(data);
    if (error || !state.success) {
      return { ok: false as const, error: "The policy could not be saved. Reload to verify its current version." };
    }
    if (action !== "draft") {
      updateTag(legalPolicyCacheTag(slug));
      revalidatePath(`/legal/${slug}`);
    }
    return { ok: true as const, state: state.data };
  } catch {
    return { ok: false as const, error: "The policy could not be saved. Reload to verify its current version." };
  }
}
