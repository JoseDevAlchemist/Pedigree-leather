/**
 * M-Pesa STK Push callback.
 *
 * Safaricom POSTs here with `Body.stkCallback`. We look up the order by the
 * `CheckoutRequestID` stored when the STK request was initiated, then update
 * `payment_status`, `status`, `payment_reference` and `paid_at`.
 *
 * No `requireRole` — Safaricom is unauthenticated. Authenticity comes from
 * matching CheckoutRequestID to an order we created and never returned to the
 * browser. Duplicate callbacks are idempotent.
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type CallbackMetadataItem = { Name: string; Value: string | number };

type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: CallbackMetadataItem[];
  };
};

type CallbackBody = {
  Body: {
    stkCallback: StkCallback;
  };
};

function metadataValue(
  callback: StkCallback,
  name: string,
): string | null {
  const item = callback.CallbackMetadata?.Item.find(
    (entry) => entry.Name === name,
  );
  return item ? String(item.Value) : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: CallbackBody;

  try {
    body = (await request.json()) as CallbackBody;
  } catch {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid JSON" },
      { status: 400 },
    );
  }

  const callback = body.Body?.stkCallback;
  if (!callback || typeof callback.CheckoutRequestID !== "string") {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Missing stkCallback" },
      { status: 400 },
    );
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = callback;
  const supabase = createAdminClient();

  const { data: order, error: lookupError } = await supabase
    .from("orders")
    .select("id, status, payment_status")
    .eq("checkout_request_id", CheckoutRequestID)
    .maybeSingle();

  if (lookupError) {
    console.error("[mpesa/callback] lookup failed:", lookupError);
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Server error" },
      { status: 500 },
    );
  }

  /* Unknown ID: acknowledge so Daraja stops retrying. This can be an old
     callback after the customer started a second STK push. */
  if (!order) {
    console.warn(
      `[mpesa/callback] no order for checkout request ${CheckoutRequestID}`,
    );
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  /* Idempotency: Daraja retries callbacks, and the browser may poll while a
     duplicate arrives. */
  if (order.payment_status === "paid") {
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Already processed",
    });
  }

  const success = ResultCode === 0;
  const receiptNumber = success
    ? metadataValue(callback, "MpesaReceiptNumber")
    : null;
  const paidAt = success ? new Date().toISOString() : null;

  /* Only advance a pre-payment order. If staff already moved it to preparing,
     do not regress the fulfilment status just because the callback arrived
     late. The payment fields still get updated either way. */
  const nextStatus = success && order.status === "pending_payment"
    ? "paid"
    : order.status;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: success ? "paid" : "failed",
      payment_method: "mpesa",
      payment_reference: success
        ? (receiptNumber ?? CheckoutRequestID)
        : null,
      paid_at: paidAt,
      status: nextStatus,
    })
    .eq("id", order.id);

  if (updateError) {
    console.error("[mpesa/callback] update failed:", updateError);
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Server error" },
      { status: 500 },
    );
  }

  if (success && nextStatus === "paid") {
    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: order.id,
        from_status: order.status,
        to_status: "paid",
        changed_by_email: null,
        note: receiptNumber
          ? `M-Pesa payment confirmed (${receiptNumber}).`
          : "M-Pesa payment confirmed.",
      });

    if (historyError) {
      /* The payment is already recorded. A missing audit row is worth a log,
         not a 500 that makes Daraja retry the whole callback. */
      console.error("[mpesa/callback] history insert failed:", historyError);
    }
  }

  /* Email is a side effect of a successful payment, never part of it. A
     missing API key, unverified domain, or Resend outage must not turn a paid
     order into a callback failure that Daraja retries. */
  if (success) {
    try {
      const [{ getOrderById }, { sendReceiptEmail }] = await Promise.all([
        import("@/lib/orders-api"),
        import("@/lib/emails/sendReceipt"),
      ]);
      const fullOrder = await getOrderById(order.id);
      if (fullOrder) {
        await sendReceiptEmail(fullOrder);
      }
    } catch (receiptError) {
      console.error("[mpesa/callback] receipt email failed:", receiptError);
    }
  }

  if (!success) {
    console.warn(
      `[mpesa/callback] ${CheckoutRequestID} failed: ${ResultCode} ${ResultDesc}`,
    );
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
