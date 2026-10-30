"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, MapPin, Truck, MessageCircle, Clock, Package, AlertCircle, RefreshCw } from "lucide-react";

import { getStatusLabel, getAllStatusSteps, getStatusStep } from "@/lib/order-status-labels";

interface ShopConfig {
  shopName: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string;
  googleMapsUrl: string | null;
  deliveryFlatRate: number;
  freeDeliveryThreshold: number;
  pickupAvailable: boolean;
}

interface OrderWithItems {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_method: "delivery" | "pickup";
  delivery_address: string | null;
  delivery_fee: number;
  subtotal: number;
  discount_total: number;
  total: number;
  status: string;
  payment_method: string | null;
  payment_status: string;
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
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_email: string | null;
  note: string | null;
  created_at: string;
}

interface OrderTimelineProps {
  order: OrderWithItems;
  shopConfig: ShopConfig;
}

export function OrderTimeline({ order, shopConfig }: OrderTimelineProps) {
  const [currentOrder, setCurrentOrder] = useState<OrderWithItems>(order);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const isDelivery = currentOrder.delivery_method === "delivery";
  const paymentStatus = currentOrder.payment_status;
  const paymentMethodLabel = currentOrder.payment_method
    ? currentOrder.payment_method === "mpesa"
      ? "M-Pesa"
      : currentOrder.payment_method === "mpesa_manual"
        ? "M-Pesa Till"
        : currentOrder.payment_method === "card"
          ? "Card"
          : "Pay on delivery"
    : "Not set";

  const currentStatus = currentOrder.status;
  const steps = getAllStatusSteps(isDelivery);
  const currentStepIndex = getStatusStep(currentStatus, isDelivery);

  /* `getAllStatusSteps` never includes "cancelled": a cancellation is a
     terminal branch, rendered separately below so it cannot appear twice. */
  const timelineSteps: string[] = steps;

  const refreshOrder = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCurrentOrder(data);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      console.error("[OrderTimeline] Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentOrder.id]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshOrder();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshOrder]);

  const isCancelled = currentStatus === "cancelled";
  const cancelledHistory = currentOrder.history?.find(
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

  const timelineElements = timelineSteps.map((step, index) => {
    const isCurrent = !isCancelled && step === currentStatus;
    const isPast = !isCancelled && index < currentStepIndex;

    const stepHistory = currentOrder.history?.find((h) => h.to_status === step);
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
            <p className="mt-1 text-sm text-muted">{formatTimestamp(timestamp)}</p>
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
    <>
      {/* Status Timeline */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4" aria-labelledby="timeline-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="timeline-heading" className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground">
            Order progress
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:inline-flex">
              Last updated: {lastRefreshed.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={refreshOrder}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-50"
              aria-label="Refresh order status"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <div className="relative flex flex-col gap-6">
          {/* Continuous connector sits under the circles, whose centres are at 1rem. */}
          <div
            className="absolute top-4 bottom-4 left-4 w-0.5 bg-border"
            aria-hidden="true"
          />
          {timelineElements}
          {cancelledElement}
        </div>
      </section>

      {/* Delivery/Pickup info */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="font-sans text-sm font-semibold tracking-wide uppercase text-foreground">
          {isDelivery ? "Delivery" : "Pickup"}
        </h2>

        {isDelivery ? (
          <>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Delivery address</p>
                <p className="mt-1 text-sm text-muted">{currentOrder.delivery_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Estimated delivery</p>
                <p className="mt-1 text-sm text-muted">Within 24-48 hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">WhatsApp confirmation</p>
                <p className="mt-1 text-sm text-muted">
                  We&apos;ll send a WhatsApp confirmation to {currentOrder.customer_phone} shortly.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Ready for pickup at</p>
                <p className="mt-1 text-sm text-muted">{shopConfig.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">WhatsApp notification</p>
                <p className="mt-1 text-sm text-muted">
                  We&apos;ll WhatsApp you when it&apos;s ready.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Payment status badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Payment:</span>
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500 bg-opacity-10 text-emerald-600 border-emerald-300 border-opacity-300">
            {paymentStatus === "paid" ? "Paid" : paymentStatus === "failed" ? "Failed" : "Pending"}
            {currentOrder.payment_method && ` (${paymentMethodLabel})`}
          </span>
        </div>
      </section>
    </>
  );
}