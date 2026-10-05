import { AlertTriangle, ArrowRight, Package, PackageCheck, PackageX, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDashboardStats } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/supabase/guards";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * The admin dashboard.
 *
 * Five numbers and nothing else, which is the most a dashboard should carry on day
 * one. `getDashboardStats()` counts **active products only** — an inactive product is
 * not in the shop, so a count that includes it puts a number on screen that nobody
 * can act on. See the note on that function.
 *
 * `requireAdmin()` first. Not because `proxy.ts` might not have run — it always does —
 * but because this is where the numbers come from, and a guard that is only in the
 * proxy is a guard that disappears the day somebody renames a file.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const stats = await getDashboardStats();

  /* A card is worth a colour only when its number is worth acting on. "Total
     products" being non-zero is not news; "3 products are sold out" is. */
  const cards = [
    { label: "Total products", value: stats.totalProducts, icon: Package, tone: "neutral" },
    { label: "Bags", value: stats.totalBags, icon: Shapes, tone: "neutral" },
    { label: "Shoes", value: stats.totalShoes, icon: Shapes, tone: "neutral" },
    {
      label: "Low stock",
      value: stats.lowStock,
      icon: AlertTriangle,
      tone: stats.lowStock > 0 ? "warn" : "neutral",
      hint: "Fewer than 5 left",
    },
    {
      label: "Out of stock",
      value: stats.outOfStock,
      icon: PackageX,
      tone: stats.outOfStock > 0 ? "alert" : "neutral",
      hint: "0 left",
    },
  ] as const;

  const hasStockProblem = stats.lowStock > 0 || stats.outOfStock > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Catalogue
          </h2>
          <p className="mt-1 text-sm text-muted">
            {stats.totalProducts} {stats.totalProducts === 1 ? "product" : "products"} listed
            {hasStockProblem ? " — some need restocking" : " — nothing needs restocking"}.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Add product
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {/* Five cards. Two up on a phone because one would be needlessly tall and three
          would be unreadably narrow; five across from `lg`, which is where a fifth
          column of numbers fits without wrapping them. */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className={`rounded-xl border bg-card p-4 ${
                card.tone === "alert"
                  ? "border-primary/40"
                  : card.tone === "warn"
                    ? "border-accent/50"
                    : "border-border"
              }`}
            >
              <dt className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
                <Icon
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={
                    card.tone === "alert"
                      ? "text-primary"
                      : card.tone === "warn"
                        ? "text-accent"
                        : "text-muted"
                  }
                />
                {card.label}
              </dt>
              <dd
                className={`mt-2 font-serif text-3xl font-semibold tabular-nums ${
                  card.tone === "alert"
                    ? "text-primary"
                    : card.tone === "warn"
                      ? "text-foreground"
                      : "text-foreground"
                }`}
              >
                {card.value}
              </dd>
              {"hint" in card ? (
                <p className="mt-0.5 text-xs text-muted">{card.hint}</p>
              ) : null}
            </div>
          );
        })}
      </dl>

      <RecentActivity hasStockProblem={hasStockProblem} outOfStock={stats.outOfStock} />
    </div>
  );
}

/**
 * "Recent activity".
 *
 * Empty, on purpose, and honest about why rather than filling it with a placeholder
 * that implies a feature exists.
 *
 * An activity log wants a row per *change*, written by the actions in
 * `lib/actions/products.ts`. There is no such table in 001_initial.sql yet, so there
 * is nothing to show and inventing a list of fake entries would be worse than the
 * empty state: somebody would read "Karura Tote was updated 2h ago" and believe it.
 * `docs/ADMIN_INTEGRATION_TODO.md` has the audit log as the first item.
 *
 * The stock warning is real data, though, and it is the thing this panel would
 * otherwise have shown. So it is here instead, above the empty state.
 */
function RecentActivity({
  hasStockProblem,
  outOfStock,
}: {
  hasStockProblem: boolean;
  outOfStock: number;
}) {
  return (
    <section className="mt-10">
      <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
        Recent activity
      </h3>

      <div className="mt-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
        {hasStockProblem ? (
          <>
            <PackageCheck
              size={24}
              strokeWidth={1.75}
              className="mx-auto text-accent"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-foreground">
              {outOfStock > 0
                ? `${outOfStock} ${outOfStock === 1 ? "product is" : "products are"} out of stock.`
                : "Some products are running low."}{" "}
              They are still listed in the shop.
            </p>
            <Link
              href="/admin/products"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Go to products
              <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <Package size={24} strokeWidth={1.75} className="mx-auto text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-foreground">No changes recorded yet.</p>
            <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted">
              Every edit you make from here on will be listed here. For now the
              catalogue itself is the place to look.
            </p>
          </>
        )}
      </div>
    </section>
  );
}