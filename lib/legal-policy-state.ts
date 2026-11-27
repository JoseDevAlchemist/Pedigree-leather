import { z } from "zod";

export const legalPolicyState = z.object({
  revision: z.string().nullable(),
  draft: z.string().nullable(),
  published: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publishedBy: z.string().nullable(),
  canRestore: z.boolean(),
});

export type LegalPolicyState = z.infer<typeof legalPolicyState>;
