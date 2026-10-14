"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, MapPin, Truck, MessageCircle, Clock, Package, AlertCircle, RefreshCw } from "lucide-react";

import { getStatusLabel, getStatusColor, getAllStatusSteps, getStatusStep } from "@/lib/order-status-labels";

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
      : currentOrder.payment_method === "card"
      ? "Card"
      : "Pay on delivery"
    : "Not set";

  const currentStatus = currentOrder.status;
  const steps = getAllStatusSteps(isDelivery);
  const currentStepIndex = getStatusStep(currentStatus, isDelivery);

  // Build timeline steps array
  const timelineSteps: string[] = [];

  if (currentStatus === "cancelled") {
    steps.forEach(s => {
      if (s !== "cancelled") timelineSteps.push(s);
    });
    timelineSteps.push("cancelled");
  } else {
    steps.forEach(s => {
      timelineSteps.push(s);
    });
  }

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

  // Helper function to build dot className
  function getDotClassName(isCurrent: boolean, isPast: boolean, isCancelled: boolean, step: string): string {
    const base = "absolute -left-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ";
    if (isCurrent) {
      return base + "bg-primary text-primary-foreground ring-4 ring-primary ring-opacity-20";
    }
    if (isPast) {
      return base + "bg-emerald-500 text-white";
    }
    if (isCancelled && step !== "cancelled") {
      return base + "bg-muted bg-opacity-50";
    }
    return base + "border-border text-muted text-opacity-50";
  }

  // Helper function to build text className
  function getTextClassName(isCurrent: boolean, isPast: boolean): string {
    const base = "transition-colors ";
    if (isCurrent) return base + "text-foreground";
    if (isPast) return base + "text-muted";
    return base + "text-muted text-opacity-50";
  }

  // Build timeline elements using map with helper functions
  const timelineElements = timelineSteps.map((step, index) => {
    const isCurrent = step === currentStatus;
    const isPast = index < currentStepIndex && currentStatus !== "cancelled";
    const isCancelled = currentStatus === "cancelled";

    const stepHistory = currentOrder.history?.find((h) => h.to_status === step);
    const timestamp = stepHistory?.created_at;

    let dotIcon: React.ReactNode = null;
    if (isPast) {
      dotIcon = <CheckCircle className="size-5" aria-hidden="true" />;
    } else if (isCurrent) {
      dotIcon = <span className="font-bold">{index + 1}</span>;
    } else if (step === "pending_payment") {
      dotIcon = <Clock className="size-5" aria-hidden="true" />;
    } else if (step === "paid") {
      dotIcon = <CheckCircle className="size-5" aria-hidden="true" />;
    } else if (step === "preparing") {
      dotIcon = <Package className="size-5" aria-hidden="true" />;
    } else if (step === "ready_for_delivery") {
      dotIcon = <Truck className="size-5" aria-hidden="true" />;
    } else if (step === "out_for_delivery") {
      dotIcon = <Truck className="size-5" aria-hidden="true" />;
    } else {
      dotIcon = <CheckCircle className="size-5" aria-hidden="true" />;
    }

    const dotClassName = getDotClassName(isCurrent, isPast, isCancelled, step);
    const textClassName = getTextClassName(isCurrent, isPast);

    return (
      <div key={step} className="relative">
        {/* Dot */}
        <div className={dotClassName}>
          {dotIcon}
        </div>

        <div className={textClassName}>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {getStatusLabel(step, isDelivery)}
            </span>
            {isCurrent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary bg-opacity-10 text-primary font-medium">
                Current
              </span>
            )}
          </div>
          {timestamp && (
            <p className="mt-1 text-sm text-muted">
              {new Date(timestamp).toLocaleString("en-KE", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {stepHistory?.note && (
            <p className="mt-1 text-sm text-muted italic">
              {"\""}
              {stepHistory.note}
              {"\""}
            </p>
          )}
        </div>
      </div>
    );
  });

  // Cancelled element if needed
  const cancelledElement = currentStatus === "cancelled" ? (
    <div key="cancelled" className="relative">
      <div className="absolute -left-4 w-8 h-8 rounded-full flex items-center justify-center bg-rose-500 text-white text-sm font-medium">
        <AlertCircle className="size-5" aria-hidden="true" />
      </div>
      <div className="text-rose-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">Cancelled</span>
        </div>
        {currentOrder.history?.find((h) => h.to_status === "cancelled")?.note && (
          <p className="mt-1 text-sm text-muted italic">
            {"\""}
            {currentOrder.history?.find((h) => h.to_status === "cancelled")?.note}
            {"\""}
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

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 border-border" aria-hidden="true" />

          <div className="space-y-6 pl-12">
            {timelineElements}
            {cancelledElement}
          </div>
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