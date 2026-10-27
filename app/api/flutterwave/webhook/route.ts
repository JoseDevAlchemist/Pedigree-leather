/**
 * Flutterwave charge webhook.
 *
 * Flutterwave POSTs here when a charge completes. We verify the `verif-hash`
 * header against `FLUTTERWAVE_WEBHOOK_HASH`, check `event === 'charge.completed'`
 * with `data.status === 'successful'`, then verify via GET /v3/transactions/{id}/verify
 * before updating the order.
 *
 * Idempotent: duplicate webhooks for the same tx_ref are ignored.
 *
 * No `requireRole` — Flutterwave is unauthenticated. Authenticity comes from
 * the hash header and the tx_ref matching a pending order.
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/* Flutterwave sends the hash as `verif-hash` header. */
export async function POST(request: Request): Promise<Response> {
  const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  const incomingHash = request.headers.get("verif-hash");

  if (!expectedHash || incomingHash !== expectedHash) {
    return NextResponse.json(
      { status: "error", message: "Invalid hash" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON" },
      { status: 400 },
    );
  }

  const event = (body as { event?: string })?.event;
  const data = (body as { data?: unknown })?.data;

  if (event !== "charge.completed" || !data) {
    return NextResponse.json({ status: "ok", message: "Ignored" });
  }

  const charge = data as {
    status?: string;
    tx_ref?: string;
    flw_ref?: string;
    id?: number | string;
    amount?: number;
    currency?: string;
  };

  if (charge.status !== "successful" || !charge.tx_ref) {
    return NextResponse.json({ status: "ok", message: "Not successful" });
  }

  /* tx_ref looks like PED-<orderId>. Extract the order id. */
  const orderId = charge.tx_ref.replace(/^PED-/, "");

  const supabase = createAdminClient();

  /* Idempotency: skip if already paid. */
  const { data: existing } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();

  if (existing?.payment_status === "paid") {
    return NextResponse.json({ status: "ok", message: "Already processed" });
  }

  /* Verify with Flutterwave before trusting the webhook. */
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    console.error("[flutterwave/webhook] FLUTTERWAVE_SECRET_KEY not set");
    return NextResponse.json(
      { status: "error", message: "Server misconfigured" },
      { status: 500 },
    );
  }

  let verifyOk = false;
  try {
    const verifyResp = await fetch(
      `https://api.flutterwave.com/v3/transactions/${charge.id}/verify`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );
    const verifyBody = (await verifyResp.json()) as {
      status?: string;
      data?: { status?: string; tx_ref?: string };
    };
    verifyOk =
      verifyBody.status === "success" &&
      verifyBody.data?.status === "successful" &&
      verifyBody.data?.tx_ref === charge.tx_ref;
  } catch {
    verifyOk = false;
  }

  if (!verifyOk) {
    return NextResponse.json(
      { status: "error", message: "Verification failed" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: "card",
      status: "paid",
    })
    .eq("id", orderId);

  if (error) {
    console.error("[flutterwave/webhook] update failed:", error);
    return NextResponse.json(
      { status: "error", message: "Server error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok", message: "Paid" });
}
