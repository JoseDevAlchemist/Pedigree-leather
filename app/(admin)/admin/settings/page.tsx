import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { requireAdmin } from "@/lib/supabase/guards";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

/**
 * Settings — a placeholder with an honest label.
 *
 * Everything a shop eventually needs here (the WhatsApp number, the phone, the
 * address, the email) is currently a placeholder constant in `lib/contact.ts`, and the
 * honest fix for that is a `settings` table rather than environment variables — the
 * workshop's phone number is not a deploy-time secret and should not require a redeploy
 * to change. That table, and the form to edit it, is written up in
 * `docs/ADMIN_INTEGRATION_TODO.md`.
 *
 * So this says what it will hold, rather than pretending to be empty.
 */
export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        Settings
      </h2>

      <div className="mt-6 rounded-xl border border-border bg-card px-6 py-16 text-center">
        <Settings size={24} strokeWidth={1.75} className="mx-auto text-muted" aria-hidden="true" />

        <p className="mt-3 text-sm text-foreground">Settings coming soon.</p>

        <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted">
          The shop&rsquo;s contact details live in <code className="font-mono text-xs">lib/contact.ts</code> for
          now. They will move here, so changing the workshop&rsquo;s number is a form
          rather than a redeploy.
        </p>
      </div>
    </div>
  );
}