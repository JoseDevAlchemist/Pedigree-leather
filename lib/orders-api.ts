import "server-only";

/**
 * Server-only order operations.
 *
 * All database access for orders goes through here. Components never call
 * Supabase directly — they call server actions, which call these functions.
 */

import type { CartItem } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type CheckoutLine = Pick<CartItem, "productId" | "colorId" | "sizeId" | "unitPrice" | "quantity">;

export interface OrderInput {
  requestId: string;
  customer: {
    name: string;
    email: string | null;
    phone: string;
  };
  deliveryMethod: "delivery" | "pickup";
  deliveryAddress: string | null;
  items: CheckoutLine[];
  subtotal: number;
  deliveryFee: number;
  notes: string | null;
  zoneId: string | null;
  zoneName: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  color_name: string;
  size_system?: string | null;
  size_label?: string | null;
  color_hex: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderHistory {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_email: string | null;
  note: string | null;
  created_at: string;
}

export interface OrderWithItems {
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
  checkout_request_id?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history: OrderHistory[];
}

/**
 * Generate a unique order number: PED-YYYY-XXXX
 * where XXXX is a zero-padded sequence per year.
 *
 * Handles race conditions by retrying once on unique constraint violation.
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PED-${year}-`;

  const supabase = createAdminClient();

  // Find the latest order number for this year
  const { data: latest, error } = await supabase
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    throw new Error(`Failed to fetch latest order number: ${error.message}`);
  }

  let sequence = 1;
  if (latest) {
    const lastSequence = parseInt(latest.order_number.replace(prefix, ""), 10);
    if (!Number.isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const orderNumber = `${prefix}${sequence.toString().padStart(4, "0")}`;

  // Try to insert a placeholder to reserve this number (optional but helps with race conditions)
  // We'll handle conflicts in createOrder instead
  return orderNumber;
}

/** Reserve stock and persist the order and its lines in one transaction. */
export async function createOrder(input: OrderInput) {
  const supabase = createAdminClient();
  const items = input.items.map((item) => ({
    product_id: item.productId,
    color_id: item.colorId,
    size_id: item.sizeId ?? null,
    unit_price: item.unitPrice,
    quantity: item.quantity,
  }));

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.rpc("website_create_order", {
      p_request_id: input.requestId,
      p_order: {
        order_number: await generateOrderNumber(),
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
        delivery_method: input.deliveryMethod,
        delivery_address: input.deliveryAddress,
        delivery_fee: input.deliveryFee,
        subtotal: input.subtotal,
        notes: input.notes,
        zone_id: input.zoneId,
        zone_name: input.zoneName,
      },
      p_items: items,
    }).single();

    if (data) return { orderId: data.order_id, orderNumber: data.order_number, created: data.created };
    if (error?.code === "23505") continue;
    if (error?.message === "website_variant_unavailable") {
      throw new Error("An item or shoe size in your cart is unavailable. Please update your cart.");
    }
    if (error?.message === "website_price_changed") {
      throw new Error("A price in your cart has changed. Please remove and re-add the item.");
    }
    throw new Error("Checkout could not reserve your items. Please try again.");
  }

  throw new Error("Checkout could not assign an order number. Please try again.");
}

/**
 * Get order by UUID with its items and status history.
 * Uses service role client so guests can fetch their confirmation page.
 */
export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (*),
      order_status_history (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  if (!order) return null;

  // Transform order_items to items for the OrderWithItems type
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const orderHistory = Array.isArray(order.order_status_history) ? order.order_status_history : [];
  return {
    ...order,
    items: orderItems,
    history: orderHistory,
  } as unknown as OrderWithItems;
}

/**
 * Get order by order number with its items.
 */
export async function getOrderByNumber(orderNumber: string): Promise<OrderWithItems | null> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (*),
      order_status_history (*)
    `,
    )
    .eq("order_number", orderNumber)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  if (!order) return null;

  // Transform order_items to items for the OrderWithItems type
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const orderHistory = Array.isArray(order.order_status_history) ? order.order_status_history : [];
  return {
    ...order,
    items: orderItems,
    history: orderHistory,
  } as unknown as OrderWithItems;
}