"use client";

import { useState } from "react";
import { Truck, Package, MapPin, User, Phone, Mail, Clock, AlertCircle, CheckCircle, Check } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

import { formatPrice } from "@/lib/format";
import { getStatusLabel, getAllStatusSteps, type OrderStatus } from "@/lib/order-status-labels";
import { updateOrderStatusAction, cancelOrderAction } from "@/lib/actions/orders-admin";
import { useToast } from "@/components/admin/Toast";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_method: string;
  delivery_address: string | null;
  delivery_fee: number;
  subtotal: number;
  discount_total: number;
  total: number;
  status: string;
  payment_method: string | null;
  payment_status: string;
  payment_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history: OrderHistory[];
}

interface OrderItem {
  id: string;
  product_name: string;
  product_slug: string;
  color_name: string;
  color_hex: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface OrderHistory {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_email: string | null;
  note: string | null;
  created_at: string;
}

export function AdminOrderDetail({ order }: { order: Order }) {
  const toast = useToast();
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isDelivery = order.delivery_method === "delivery";
  const currentStatus = order.status as OrderStatus;
  const steps = getAllStatusSteps(isDelivery);

  // Filter valid next statuses based on current status
  const validNextStatuses = getValidNextStatuses(currentStatus);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const formData = new FormData();
    formData.append("orderId", order.id);
    formData.append("status", newStatus);

    const result = await updateOrderStatusAction(formData);
    setUpdating(false);

    if (result.ok) {
      toast.success("Status updated");
      window.location.reload();
    } else {
      toast.error("Failed to update status", result.error);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    const formData = new FormData();
    formData.append("orderId", order.id);
    formData.append("reason", cancelReason);

    const result = await cancelOrderAction(formData);
    setCancelling(false);

    if (result.ok) {
      toast.success("Order cancelled");
      setShowCancelDialog(false);
      window.location.reload();
    } else {
      toast.error("Failed to cancel order", result.error);
    }
  };

  const isCancelled = currentStatus === "cancelled";
  const currentStepIndex = steps.indexOf(currentStatus);
  const cancelledHistory = order.history.find(
    (entry) => entry.to_status === "cancelled",
  );

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function futureIcon(step: string): React.ReactNode {
    if (step === "pending_payment") return <Clock className="size-4" aria-hidden="true" />;
    if (step === "preparing") return <Package className="size-4" aria-hidden="true" />;
    if (step === "ready_for_delivery" || step === "out_for_delivery") {
      return <Truck className="size-4" aria-hidden="true" />;
    }
    return <Check className="size-4" aria-hidden="true" />;
  }

  const timelineElements = steps.map((step, index) => {
    const isCurrent = !isCancelled && step === currentStatus;
    const isPast = !isCancelled && currentStepIndex > index;

    const stepHistory = order.history.find((h) => h.to_status === step);
    const timestamp = stepHistory?.created_at;

    const circleClassName = isPast
      ? "bg-primary text-white"
      : isCurrent
        ? "border-2 border-primary bg-background text-primary ring-4 ring-primary/15"
        : "bg-muted text-white";

    return (
      <div key={step} className="relative flex items-start gap-4">
        <div
          className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${circleClassName}`}
        >
          {isPast ? (
            <Check className="size-4" strokeWidth={3} aria-hidden="true" />
          ) : isCurrent ? (
            <span className="size-2.5 rounded-full bg-primary motion-safe:animate-pulse" />
          ) : (
            futureIcon(step)
          )}
        </div>

        <div className="flex min-h-8 min-w-0 flex-1 flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium ${isPast || isCurrent ? "text-foreground" : "text-muted"}`}
            >
              {getStatusLabel(step, isDelivery)}
            </span>
            {isCurrent && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Current
              </span>
            )}
          </div>
          {timestamp && (
            <p className="mt-1 text-sm text-muted">
              {formatTimestamp(timestamp)}
              {stepHistory?.changed_by_email && (
                <span> · by {stepHistory.changed_by_email}</span>
              )}
            </p>
          )}
          {stepHistory?.note && (
            <p className="mt-1 text-sm text-muted italic">
              &quot;{stepHistory.note}&quot;
            </p>
          )}
        </div>
      </div>
    );
  });

  const cancelledElement = isCancelled ? (
    <div key="cancelled" className="relative flex items-start gap-4">
      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
        <AlertCircle className="size-4" aria-hidden="true" />
      </div>
      <div className="flex min-h-8 min-w-0 flex-1 flex-col justify-center text-rose-600">
        <span className="font-medium">Cancelled</span>
        {cancelledHistory?.created_at && (
          <p className="mt-1 text-sm text-muted">
            {formatTimestamp(cancelledHistory.created_at)}
          </p>
        )}
        {cancelledHistory?.note && (
          <p className="mt-1 text-sm text-muted italic">
            &quot;{cancelledHistory.note}&quot;
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Order #{order.order_number}
            </h1>
            <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full border bg-amber-500 bg-opacity-10 text-amber-700 border-amber-300 border-opacity-300">
              {getStatusLabel(currentStatus, isDelivery)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            All orders
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Status Timeline */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Status Timeline
            </h2>

            <div className="relative flex flex-col gap-6">
              {/* Continuous connector sits under the circles, whose centres are at 1rem. */}
              <div
                className="absolute top-4 bottom-4 left-4 w-0.5 bg-border"
                aria-hidden="true"
              />
              {timelineElements}
              {cancelledElement}
            </div>

            {/* Status update controls */}
            {currentStatus !== "delivered" && currentStatus !== "cancelled" && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-medium text-foreground mb-3">Update status</h3>
                <div className="flex flex-wrap gap-2">
                  {validNextStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={updating}
                      className={status === "cancelled"
                        ? "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 border-rose-300 text-rose-600 hover:bg-rose-50"
                        : "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 border-primary text-primary hover:bg-primary bg-opacity-5"
                      }
                    >
                      {status === "cancelled" ? (
                        <AlertCircle className="size-4" aria-hidden="true" />
                      ) : (
                        <CheckCircle className="size-4" aria-hidden="true" />
                      )}
                      {getStatusLabel(status, isDelivery)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Customer & Delivery Info */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Customer & Delivery
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <User className="size-4 text-muted" aria-hidden="true" />
                  Customer
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Name</dt>
                    <dd className="font-medium text-foreground">{order.customer_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Phone</dt>
                    <dd className="font-medium text-foreground">{order.customer_phone}</dd>
                  </div>
                  {order.customer_email && (
                    <div className="flex justify-between">
                      <dt className="text-muted">Email</dt>
                      <dd className="font-medium text-foreground">{order.customer_email}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  {isDelivery ? <Truck className="size-4 text-muted" aria-hidden="true" /> : <Package className="size-4 text-muted" aria-hidden="true" />}
                  {isDelivery ? "Delivery" : "Pickup"}
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Method</dt>
                    <dd className="font-medium text-foreground capitalize">{order.delivery_method}</dd>
                  </div>
                  {isDelivery && order.delivery_address && (
                    <div className="flex justify-between">
                      <dt className="text-muted">Address</dt>
                      <dd className="font-medium text-foreground max-w-xs truncate">{order.delivery_address}</dd>
                    </div>
                  )}
                  {!isDelivery && (
                    <div className="flex justify-between">
                      <dt className="text-muted">Location</dt>
                      <dd className="font-medium text-foreground">Rosslyn Luxury Mall, Annex 2, Shop RLM 48</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>

          {/* Order Items */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Items
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-sm text-muted">Item</th>
                    <th className="text-left py-2 px-2 font-medium text-sm text-muted">Color</th>
                    <th className="text-right py-2 px-2 font-medium text-sm text-muted w-16">Qty</th>
                    <th className="text-right py-2 px-2 font-medium text-sm text-muted w-24">Price</th>
                    <th className="text-right py-2 px-2 font-medium text-sm text-muted w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted bg-opacity-50">
                      <td className="py-2 px-2">
                        <p className="font-medium text-foreground">{item.product_name}</p>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: item.color_hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }}
                            aria-hidden="true"
                          />
                          <span className="text-muted">{item.color_name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground">{item.quantity}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground">{formatPrice(item.unit_price)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-foreground">{formatPrice(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Order Totals */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Totals
            </h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-medium tabular-nums text-foreground">{formatPrice(order.subtotal)}</dd>
              </div>

              {order.discount_total > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount</dt>
                  <dd className="font-medium tabular-nums">-{formatPrice(order.discount_total)}</dd>
                </div>
              )}

              <div className="flex justify-between">
                <dt className="text-muted">{isDelivery ? "Delivery" : "Pickup"}</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {order.delivery_fee === 0 ? <span className="text-emerald-600">Free</span> : formatPrice(order.delivery_fee)}
                </dd>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg">
                  <dt className="font-semibold text-foreground">Total</dt>
                  <dd className="font-serif font-bold tabular-nums text-foreground">{formatPrice(order.total)}</dd>
                </div>
              </div>
            </dl>
          </section>

          {/* Payment Info */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Payment
            </h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Method</dt>
                <dd className="font-medium text-foreground capitalize">{order.payment_method?.replace("_", " ") || "\u2014"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Status</dt>
                <dd className="font-medium tabular-nums text-emerald-600">
                  {order.payment_status === "pending" ? "Awaiting payment" : order.payment_status === "paid" ? "Paid" : "Failed"}
                </dd>
              </div>
              {order.payment_reference && (
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">Reference</dt>
                  <dd className="break-all text-right font-mono text-xs text-foreground">
                    {order.payment_reference}
                  </dd>
                </div>
              )}
              {order.paid_at && (
                <div className="flex justify-between">
                  <dt className="text-muted">Paid at</dt>
                  <dd className="text-right tabular-nums text-foreground">
                    {new Date(order.paid_at).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Notes */}
          {order.notes && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
                Customer Notes
              </h2>
              <p className="text-sm text-muted whitespace-pre-wrap">{order.notes}</p>
            </section>
          )}
        </div>

        {/* Sidebar - Order Summary & Actions */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {/* Quick Actions */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Quick Actions
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => navigator.clipboard.writeText(order.customer_phone)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 transition-colors"
              >
                <Phone className="size-4" aria-hidden="true" />
                Copy phone
              </button>
              {order.customer_email && (
                <button
                  onClick={() => navigator.clipboard.writeText(order.customer_email!)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 transition-colors"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Copy email
                </button>
              )}
              {isDelivery && order.delivery_address && (
                <button
                  onClick={() => navigator.clipboard.writeText(order.delivery_address!)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 transition-colors"
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  Copy address
                </button>
              )}
            </div>
          </section>

          {/* Cancel Dialog Trigger */}
          {currentStatus !== "delivered" && currentStatus !== "cancelled" && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 bg-opacity-50 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <AlertCircle className="size-4" aria-hidden="true" />
              Cancel order
            </button>
          )}

          {/* Order Meta */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground mb-4">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Created</dt>
                <dd className="font-medium text-foreground">
                  {new Date(order.created_at).toLocaleString("en-KE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Updated</dt>
                <dd className="font-medium text-foreground">
                  {new Date(order.updated_at).toLocaleString("en-KE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {/* Cancel Dialog */}
      <AnimatePresence>
        {showCancelDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
            onClick={() => setShowCancelDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertCircle className="size-5" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">Cancel order</h3>
              </div>

              <p className="text-sm text-muted mb-4">
                This will cancel order <strong>#{order.order_number}</strong> and notify the customer.
                The action cannot be undone.
              </p>

              <div className="space-y-3">
                <label htmlFor="cancel-reason" className="block text-sm font-medium text-foreground">
                  Reason for cancellation <span className="text-primary" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for cancellation..."
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary ring-opacity-40"
                  required
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 transition-colors"
                >
                  Keep order
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling || !cancelReason.trim()}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? "Cancelling..." : "Cancel order"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getValidNextStatuses(currentStatus: string): string[] {
  const flow = [
    "pending_payment",
    "paid",
    "preparing",
    "ready_for_delivery",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ];

  const currentIndex = flow.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex >= flow.length - 1) return [];

  // Allow moving to next step + cancelled
  const nextStatuses = flow.slice(currentIndex + 1, currentIndex + 2);
  return [...nextStatuses, "cancelled"];
}