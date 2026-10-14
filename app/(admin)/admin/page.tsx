import { AlertTriangle, ArrowRight, Package, PackageCheck, PackageX, Shapes, Truck, Clock, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDashboardStats, getOrderStats, type AdminOrder } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/supabase/guards";
import { getStatusLabel, getStatusColor } from "@/lib/order-status-labels";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * The admin dashboard.
 *
 * Shows product stats (from getDashboardStats) and order stats (from getOrderStats).
 * Order stats include: pending payment, paid (to prepare), out for delivery today,
 * and the 5 most recent orders.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const [stats, orderStats] = await Promise.all([
    getDashboardStats(),
    getOrderStats(),
  ]);

  /* A card is worth a colour only when its number is worth acting on. "Total
     products" being non-zero is not news; "3 products are sold out" is. */
  const productCards = [
    { label: "Total products", value: stats.totalProducts, icon: Package, tone: "neutral" as const },
    { label: "Bags", value: stats.totalBags, icon: Shapes, tone: "neutral" as const },
    { label: "Shoes", value: stats.totalShoes, icon: Shapes, tone: "neutral" as const },
    {
      label: "Low stock",
      value: stats.lowStock,
      icon: AlertTriangle,
      tone: stats.lowStock > 0 ? "warn" : "neutral",
      hint: "Fewer than 5 left",
    } as const,
    {
      label: "Out of stock",
      value: stats.outOfStock,
      icon: PackageX,
      tone: stats.outOfStock > 0 ? "alert" : "neutral",
      hint: "0 left",
    } as const,
  ] as const;

  const orderCards = [
    {
      label: "Pending payment",
      value: orderStats.pendingOrders,
      icon: Clock,
      tone: orderStats.pendingOrders > 0 ? "warn" : "neutral",
      href: "/admin/orders?status=pending_payment",
    } as const,
    {
      label: "To prepare",
      value: orderStats.ordersToPrepare,
      icon: Package,
      tone: orderStats.ordersToPrepare > 0 ? "warn" : "neutral",
      href: "/admin/orders?status=paid",
    } as const,
    {
      label: "Out for delivery today",
      value: orderStats.outForDeliveryToday,
      icon: Truck,
      tone: orderStats.outForDeliveryToday > 0 ? "alert" : "neutral",
      href: "/admin/orders?status=out_for_delivery",
    } as const,
  ] as const;

  const hasStockProblem = stats.lowStock > 0 || stats.outOfStock > 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Catalogue section */}
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

      {/* Product stat cards */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {productCards.map((card) => {
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

      {/* Orders section */}
      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Orders
          </h2>
          <p className="mt-1 text-sm text-muted">
            {orderStats.pendingOrders + orderStats.ordersToPrepare + orderStats.outForDeliveryToday} active orders
          </p>
        </div>

        <Link
          href="/admin/orders"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-primary px-5 text-sm font-semibold tracking-wide text-primary transition-colors duration-150 ease-out hover:bg-primary hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          View all orders
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {/* Order stat cards */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {orderCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 ${
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
              <dd className="mt-2 font-serif text-3xl font-semibold tabular-nums text-foreground">
                {card.value}
              </dd>
            </Link>
          );
        })}
      </dl>

      {/* Recent orders */}
      {orderStats.recentOrders.length > 0 && (
        <section className="mt-10" aria-labelledby="recent-orders-heading">
          <h3 id="recent-orders-heading" className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Recent orders
          </h3>

          <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Order</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden sm:table-cell">Method</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-muted">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orderStats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-medium text-foreground hover:text-accent"
                      >
                        #{order.order_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{order.customer_name}</p>
                        <p className="text-sm text-muted">{order.customer_phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.delivery_method === "delivery"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {order.delivery_method === "delivery" ? (
                          <>
                            <Truck size={10} aria-hidden="true" />
                            Delivery
                          </>
                        ) : (
                          <>
                            <Package size={10} aria-hidden="true" />
                            Pickup
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
                        style={{
                          backgroundColor: `var(--color-${getStatusColor(order.status).replace("text-", "")}-500)`,
                          borderColor: `var(--color-${getStatusColor(order.status).replace("text-", "")}-300)`,
                          color: `var(--color-${getStatusColor(order.status).replace("text-", "")}-600)`,
                        }}
                      >
                        {getStatusLabel(order.status, order.delivery_method === "delivery")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground">
                      {order.total.toLocaleString("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-sm text-muted">
                      {new Date(order.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ProductActivity hasStockProblem={hasStockProblem} outOfStock={stats.outOfStock} />
    </div>
  );
}

function ProductActivity({
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