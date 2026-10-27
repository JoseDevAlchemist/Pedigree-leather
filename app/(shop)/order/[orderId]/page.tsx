import { notFound } from "next/navigation";
import { CheckCircle, MessageCircle } from "lucide-react";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { getOrderById } from "@/lib/orders-api";
import { getShopConfig } from "@/lib/shop-config";
import { OrderTimeline } from "@/components/shop/OrderTimeline";

/* ---------------------------------------------------------------------------
   Order confirmation page (Server Component)
   --------------------------------------------------------------------------- */

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    notFound();
  }

  const [order, shopConfig] = await Promise.all([
    getOrderById(orderId),
    getShopConfig(),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      {/* Success state */}
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent bg-opacity-10">
          <CheckCircle className="size-8 text-accent" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Order received
          </h1>
          <p className="mt-2 max-w-md mx-auto text-pretty leading-relaxed text-muted">
            Thank you, {order.customer_name}. We&apos;ve received your order and it&apos;s being processed.
          </p>
        </div>
      </div>

      {/* Order number */}
      <div className="my-8 text-center">
        <p className="font-mono text-lg font-medium tracking-wider text-foreground">
          Order #{order.order_number}
        </p>
        <p className="mt-1 text-sm text-muted">
          Placed {new Date(order.created_at).toLocaleDateString("en-KE", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Status Timeline + Delivery/Pickup info - Client component with refresh */}
      <OrderTimeline order={order} shopConfig={shopConfig} />

      {/* Order summary */}
      <section className="mt-8 space-y-4" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground">
          Order summary
        </h2>

        {/* Mobile: stacked cards. Desktop: table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 font-medium text-muted">Item</th>
                <th className="text-left py-3 font-medium text-muted">Color</th>
                <th className="text-right py-3 font-medium text-muted w-20">Qty</th>
                <th className="text-right py-3 font-medium text-muted w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted bg-opacity-50">
                  <td className="py-3">
                    <p className="font-medium text-foreground line-clamp-1">{item.product_name}</p>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.color_hex,
                          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
                        }}
                        aria-hidden="true"
                      />
                      <span className="text-muted">{item.color_name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">{item.quantity}</td>
                  <td className="py-3 text-right tabular-nums font-medium text-foreground">
                    {formatPrice(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="lg:hidden space-y-3" role="list">
          {order.items.map((item) => (
            <article
              key={item.id}
              className="flex gap-3 rounded-lg border border-border bg-card p-3"
              role="listitem"
            >
              <div
                className="size-12 shrink-0 rounded-lg"
                style={{
                  backgroundColor: item.color_hex,
                  boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
                }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground line-clamp-1">{item.product_name}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: item.color_hex,
                      boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
                    }}
                    aria-hidden="true"
                  />
                  <span>{item.color_name}</span>
                  <span>×</span>
                  <span className="tabular-nums">{item.quantity}</span>
                </div>
              </div>
              <p className="shrink-0 font-medium tabular-nums text-foreground">
                {formatPrice(item.line_total)}
              </p>
            </article>
          ))}
        </div>

        {/* Totals */}
        <dl className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatPrice(order.subtotal)}</dd>
          </div>

          {order.discount_total > 0 && (
            <div className="flex justify-between text-primary">
              <dt>Discount</dt>
              <dd className="font-medium tabular-nums">\u2212{formatPrice(order.discount_total)}</dd>
            </div>
          )}

          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {order.delivery_fee === 0 ? (
                <span className="text-primary">Free</span>
              ) : (
                formatPrice(order.delivery_fee)
              )}
            </dd>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex justify-between text-lg">
              <dt className="font-semibold text-foreground">Total</dt>
              <dd className="font-serif font-bold tabular-nums text-foreground">
                {formatPrice(order.total)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      {/* Footer actions */}
      <footer className="mt-8 space-y-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <a
            href={`https://wa.me/${shopConfig.whatsapp}?text=${encodeURIComponent(
              `Hello Pedigree Leather! I have a question about my order #${order.order_number}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-semibold text-charcoal transition-colors duration-200 ease-out hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Need help? WhatsApp us
          </a>
        </div>

        <Link
          href="/bags"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Continue shopping
        </Link>
      </footer>

      {/* TODO comment for WhatsApp confirmation */}
      {/*
        TODO: Trigger WhatsApp confirmation via Twilio or Meta Cloud API once credentials exist.
        The customer will receive an automatic message summarizing their order.
      */}
    </main>
  );
}