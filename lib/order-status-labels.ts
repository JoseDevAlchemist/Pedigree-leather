/**
 * Order status labels for customer-facing and admin UI.
 *
 * Maps database status values to human-readable labels.
 * Different labels for delivery vs pickup orders.
 */

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type DeliveryMethod = "delivery" | "pickup";

const DELIVERY_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment confirmed",
  preparing: "Being prepared",
  ready_for_delivery: "Ready to ship",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PICKUP_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment confirmed",
  preparing: "Being prepared",
  ready_for_delivery: "Ready for pickup",
  out_for_delivery: "Picked up",
  delivered: "Picked up",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: "text-amber-600",
  paid: "text-emerald-600",
  preparing: "text-blue-600",
  ready_for_delivery: "text-indigo-600",
  out_for_delivery: "text-violet-600",
  delivered: "text-emerald-700",
  cancelled: "text-rose-600",
};

export function getStatusLabel(status: OrderStatus | string, isDelivery: boolean = true): string {
  const labels = isDelivery ? DELIVERY_LABELS : PICKUP_LABELS;
  return labels[status as OrderStatus] || status;
}

export function getStatusColor(status: OrderStatus | string): string {
  return STATUS_COLORS[status as OrderStatus] || "text-muted";
}

export function getStatusStep(status: OrderStatus | string, isDelivery: boolean = true): number {
  const steps: OrderStatus[] = [
    "pending_payment",
    "paid",
    "preparing",
    "ready_for_delivery",
    "out_for_delivery",
    "delivered",
  ];

  // For pickup, skip out_for_delivery (goes straight from ready to delivered)
  if (!isDelivery) {
    return steps.indexOf(status as OrderStatus);
  }

  return steps.indexOf(status as OrderStatus);
}

export function getAllStatusSteps(isDelivery: boolean = true): OrderStatus[] {
  if (!isDelivery) {
    return ["pending_payment", "paid", "preparing", "ready_for_delivery", "delivered"];
  }
  return [
    "pending_payment",
    "paid",
    "preparing",
    "ready_for_delivery",
    "out_for_delivery",
    "delivered",
  ];
}