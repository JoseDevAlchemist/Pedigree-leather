import "server-only";

/**
 * Server-only order operations.
 *
 * All database access for orders goes through here. Components never call
 * Supabase directly — they call server actions, which call these functions.
 */

import type { CartItem } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderInput {
  customer: {
    name: string;
    email: string | null;
    phone: string;
  };
  deliveryMethod: "delivery" | "pickup";
  deliveryAddress: string | null;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
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

/**
 * Create an order with items, decrement stock atomically.
 *
 * Uses a transaction-like approach: insert order, insert items, update stock.
 * If any step fails, we attempt to clean up.
 */
export async function createOrder(input: OrderInput): Promise<{ orderId: string; orderNumber: string }> {
  const supabase = createAdminClient();

  // Generate order number with retry on conflict
  let orderNumber: string;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    orderNumber = await generateOrderNumber();

    // Try to insert the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
        delivery_method: input.deliveryMethod,
        delivery_address: input.deliveryAddress,
        delivery_fee: input.deliveryFee,
        subtotal: input.subtotal,
        discount_total: input.discountTotal,
        total: input.total,
        notes: input.notes,
        status: "pending_payment",
        payment_status: "pending",
        zone_id: input.zoneId,
        zone_name: input.zoneName,
      })
      .select("id")
      .single();

    if (!orderError) {
      // Order inserted successfully
      const orderId = order.id;

      // Insert order items
      const orderItems = input.items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.name,
        product_slug: item.slug,
        color_name: item.colorName,
        color_hex: item.colorHex,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        line_total: item.unitPrice * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

      if (itemsError) {
        // Rollback: delete the order
        await supabase.from("orders").delete().eq("id", orderId);
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      // Decrement stock for each item
      for (const item of input.items) {
        const { error: stockError } = await supabase.rpc("decrement_stock", {
          product_id: item.productId,
          qty: item.quantity,
        });

        if (stockError) {
          // If stock decrement fails, we have a problem.
          // The order exists but stock wasn't decremented.
          // In production, this should trigger an alert.
          console.error(`Failed to decrement stock for product ${item.productId}:`, stockError);
          // We don't rollback here because the order is already created.
          // The admin will need to handle this manually.
        }
      }

      return { orderId, orderNumber: orderNumber! };
    }

    // Handle unique constraint violation on order_number
    if (orderError.code === "23505" && orderError.message.includes("order_number")) {
      attempts++;
      // Wait a tiny bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }

    throw new Error(`Failed to create order: ${orderError.message}`);
  }

  throw new Error("Failed to generate unique order number after retries");
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