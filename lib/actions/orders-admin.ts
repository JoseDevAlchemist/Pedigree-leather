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
    if (status === "cancelled") return await cancelOrder(orderId, note ?? "", user);
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

    // Update order status. A manual move to "paid" must also settle the payment
    // fields, otherwise the receipt generated below still says "Payment pending".
    const update: {
      status: string;
      payment_status?: "paid";
      paid_at?: string;
    } = { status: newStatus };
    if (newStatus === "paid") {
      update.payment_status = "paid";
      update.paid_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .eq("status", currentStatus)
      .neq("status", "cancelled")
      .select("id")
      .maybeSingle();

    if (updateError) return { ok: false, error: updateError.message };
    if (!updated) return { ok: false, error: "Order status changed. Refresh and try again." };

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

    /* Manual "paid" transitions get the same receipt as an M-Pesa callback.
       The action still succeeds if Resend is down or misconfigured. */
    if (newStatus === "paid" && currentStatus !== "paid") {
      try {
        const { sendReceiptEmail } = await import("@/lib/emails/sendReceipt");
        const orderDetails = await getOrderById(orderId);
        if (orderDetails) {
          await sendReceiptEmail(orderDetails);
        }
      } catch (receiptError) {
        console.error("[Receipt] Email failed:", receiptError);
      }
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

    return await cancelOrder(parsed.data.orderId, parsed.data.reason, user);
  } catch (error) {
    console.error("[cancelOrderAction] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

async function cancelOrder(orderId: string, note: string, user: { email: string; role: string })
  : Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data: changed, error } = await supabase.rpc("website_cancel_order", {
    p_order_id: orderId,
    p_actor_email: user.email,
    p_actor_role: user.role,
    p_note: note,
  });

  if (error) {
    if (error.code === "P0002") return { ok: false, error: "Order not found" };
    if (error.message === "website_cancel_ineligible") {
      return { ok: false, error: "Cannot cancel order at this stage" };
    }
    console.error("[cancelOrderAction] Cancellation failed:", error);
    return { ok: false, error: "Cancellation could not be completed. Check the order and its inventory." };
  }
  if (!changed) return { ok: true };

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  revalidatePath("/order/" + orderId);
  revalidatePath("/");
  revalidatePath("/category/[slug]", "page");
  for (const category of ["bags", "shoes", "belts"]) {
    revalidatePath("/" + category + "/[slug]", "page");
  }
  try {
    const { notifyStatusChange } = await import("@/lib/whatsapp");
    const order = await getOrderById(orderId);
    if (order) {
      await notifyStatusChange({
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        status: "cancelled",
        delivery_method: order.delivery_method,
      });
    }
  } catch (notifyError) {
    console.error("[WhatsApp] Cancellation notification failed:", notifyError);
  }
  return { ok: true };
}

export interface AdminOrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total: number;
  delivery_method: "delivery" | "pickup";
  created_at: string;
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
): Promise<{ orders: AdminOrderSummary[]; total: number }> {
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
    orders: (data || []).map((row) => ({
      ...row,
      delivery_method:
        row.delivery_method === "pickup" ? ("pickup" as const) : ("delivery" as const),
    })),
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