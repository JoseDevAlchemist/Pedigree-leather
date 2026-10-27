/**
 * Flutterwave return page.
 *
 * Flutterwave redirects the customer here after paying. We verify the
 * transaction server-side (using the `transaction_id` query param) and
 * redirect to /order/[orderId] on success or /payment/error on failure.
 */

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Payment return",
  robots: { index: false, follow: false },
};

export default async function FlutterwaveReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const txRef = typeof params.tx_ref === "string" ? params.tx_ref : "";
  const transactionId = typeof params.transaction_id === "string" ? params.transaction_id : "";
  const status = typeof params.status === "string" ? params.status : "";

  if (!txRef || !transactionId) {
    notFound();
  }

  /* tx_ref looks like PED-<orderId>. */
  const orderId = txRef.replace(/^PED-/, "");

  const supabase = createAdminClient();

  /* Verify with Flutterwave. */
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    redirect(`/payment/error?reason=misconfigured`);
  }

  let verified = false;
  try {
    const resp = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const body = (await resp.json()) as {
      status?: string;
      data?: { status?: string; tx_ref?: string };
    };
    verified =
      body.status === "success" &&
      body.data?.status === "successful" &&
      body.data?.tx_ref === txRef;
  } catch {
    verified = false;
  }

  if (!verified) {
    redirect(`/payment/error?reason=verification_failed`);
  }

  /* Update the order if not already paid (idempotent). */
  const { data: existing } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();

  if (existing?.payment_status !== "paid") {
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_method: "card", status: "paid" })
      .eq("id", orderId);
  }

  redirect(`/order/${orderId}`);
}
