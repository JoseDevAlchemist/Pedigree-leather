import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { requireAdmin } from "@/lib/supabase/guards";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

/**
 * Orders — not built yet, and this says so.
 *
 * The nav item exists because an admin with three sections and a fourth coming looks
 * like a mistake, and because a link that leads somewhere is how a person finds out
 * whether it is ready. What it must not do is show an empty table with column
 * headings, because an empty table of orders reads as "there are no orders" — and the
 * true answer is "orders cannot exist yet".
 *
 * Checkout is deliberately not built in this session. See
 * `docs/ADMIN_INTEGRATION_TODO.md` for what an order table will need when it is:
 * a payment webhook, a status machine, and stock decrement on payment rather than on
 * checkout, which is the part that is easy to get wrong and hard to undo.
 */
export default async function AdminOrdersPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        Orders
      </h2>

      <div className="mt-6 rounded-xl border border-border bg-card px-6 py-16 text-center">
        <ScrollText size={24} strokeWidth={1.75} className="mx-auto text-muted" aria-hidden="true" />

        <p className="mt-3 text-sm text-foreground">
          Orders will appear here once checkout is live.
        </p>

        <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted">
          There is no way to buy anything yet, so there is nothing to show. This page is
          here so the section exists before it is needed.
        </p>
      </div>
    </div>
  );
}