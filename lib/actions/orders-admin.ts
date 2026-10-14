/**
 * Admin orders actions — server actions for order management.
 */

"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdminUser, requireRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { getOrderById } from "@/lib/orders-api";

const statusSchema = z.enum([
  "pending_payment",
  "paid",
  "preparing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: statusSchema,
  note: z.string().max(500).optional(),
});

const cancelSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

/**
 * Update order status (owner or worker).
 * Worker can only move forward through the flow.
 */
export async function updateOrderStatusAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "Not authorized" };

    const rawData = {
      orderId: formData.get("orderId"),
      status: formData.get("status"),
      note: formData.get("note") || "",
    };

    const parsed = updateStatusSchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    const { orderId, status, note } = parsed.data;
    const supabase = createAdminClient();

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { ok: false, error: "Order not found" };
    }

    const currentStatus = order.status as z.infer<typeof statusSchema>;
    const newStatus = status;

    // Validate transition for workers
    if (user.role === "worker") {
      const allowedTransitions: Record<string, string[]> = {
        pending_payment: ["paid", "cancelled"],
        paid: ["preparing", "cancelled"],
        preparing: ["ready_for_delivery"],
        ready_for_delivery: ["out_for_delivery"],
        out_for_delivery: ["delivered"],
        delivered: [],
        cancelled: [],
      };

      const allowed = allowedTransitions[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        return { ok: false, error: `Cannot move from ${currentStatus} to ${newStatus}` };
      }
    }

    // Update order status
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Insert into status history
    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: orderId,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by_email: user.email,
        note: note || null,
      });

    if (historyError) {
      console.error("[updateOrderStatusAction] History error:", historyError);
      // Don't fail the action if history fails
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    // Send status change notification (don't fail the action if WhatsApp fails)
    try {
      const { notifyStatusChange } = await import("@/lib/whatsapp");
      const orderDetails = await getOrderById(orderId);
      if (orderDetails) {
        await notifyStatusChange({
          order_number: orderDetails.order_number,
          customer_name: orderDetails.customer_name,
          customer_phone: orderDetails.customer_phone,
          status: newStatus,
          delivery_method: orderDetails.delivery_method,
        });
      }
    } catch (whatsappError) {
      console.error("[WhatsApp] Status notification failed:", whatsappError);
    }

    return { ok: true };
  } catch (error) {
    console.error("[updateOrderStatusAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

/**
 * Cancel order (worker can only cancel pending_payment or paid).
 */
export async function cancelOrderAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "Not authorized" };

    const rawData = {
      orderId: formData.get("orderId"),
      reason: formData.get("reason"),
    };

    const parsed = cancelSchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    const { orderId, reason } = parsed.data;
    const supabase = createAdminClient();

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { ok: false, error: "Order not found" };
    }

    const currentStatus = order.status as z.infer<typeof statusSchema>;

    // Worker can only cancel pending_payment or paid
    if (user.role === "worker" && !["pending_payment", "paid"].includes(currentStatus)) {
      return { ok: false, error: "Cannot cancel order at this stage" };
    }

    // Update order status to cancelled
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Insert into status history
    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: orderId,
        from_status: currentStatus,
        to_status: "cancelled",
        changed_by_email: user.email,
        note: reason,
      });

    if (historyError) {
      console.error("[cancelOrderAction] History error:", historyError);
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    // Send cancellation notification (don't fail the action if WhatsApp fails)
    try {
      const { notifyStatusChange } = await import("@/lib/whatsapp");
      const orderDetails = await getOrderById(orderId);
      if (orderDetails) {
        await notifyStatusChange({
          order_number: orderDetails.order_number,
          customer_name: orderDetails.customer_name,
          customer_phone: orderDetails.customer_phone,
          status: "cancelled",
          delivery_method: orderDetails.delivery_method,
        });
      }
    } catch (whatsappError) {
      console.error("[WhatsApp] Cancellation notification failed:", whatsappError);
    }

    return { ok: true };
  } catch (error) {
    console.error("[cancelOrderAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

/**
 * Get orders for admin list with filters.
 */
export async function getOrdersAdmin(
  filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ orders: any[]; total: number }> {
  await requireRole("worker");
  const supabase = createAdminClient();

  const { status, search, page = 1, limit = 20 } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("orders")
    .select("*, order_items(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`order_number.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    orders: data || [],
    total: count || 0,
  };
}

/**
 * Get single order with items and history for admin detail.
 */
export async function getOrderAdmin(orderId: string) {
  await requireRole("worker");
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  const { data: history, error: historyError } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (historyError) {
    console.error("[getOrderAdmin] History error:", historyError);
  }

  return {
    ...order,
    items: order.order_items || [],
    history: history || [],
  };
}