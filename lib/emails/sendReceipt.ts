import "server-only";

import { createElement, type ReactElement } from "react";
import {
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { Resend } from "resend";

import type { OrderWithItems } from "@/lib/orders-api";

import { ReceiptPDF } from "@/lib/emails/ReceiptPDF";

/* Resend only allows onboarding@resend.dev until a domain is verified. Set
   RESEND_FROM_EMAIL (e.g. "Pedigree Leather <hello@pedigreeleather.co.ke>")
   once the domain is live. */
const FROM =
  process.env.RESEND_FROM_EMAIL ??
  "Pedigree Leather <onboarding@resend.dev>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendReceiptEmail(
  order: OrderWithItems,
): Promise<{ ok: boolean; error?: string }> {
  if (!order.customer_email) {
    console.warn(
      `[receipt] Order ${order.order_number} has no customer email; skipping receipt.`,
    );
    return { ok: false, error: "Order has no customer email" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[receipt] RESEND_API_KEY is not set; skipping receipt for ${order.order_number}.`,
    );
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  try {
    /* @react-pdf/renderer ships its own React element typings, which clash
       with the app's React 19 types at the createElement boundary. The cast is
       confined to this call; the component itself stays fully typed. */
    const pdf = await renderToBuffer(
      createElement(ReceiptPDF, { order }) as unknown as ReactElement<DocumentProps>,
    );

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: order.customer_email,
      subject: `Your Pedigree Leather Receipt (#${order.order_number})`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #2b2b2b; line-height: 1.6;">
          <h2 style="color: #5d4037; margin-bottom: 8px;">Thank you, ${escapeHtml(order.customer_name)}.</h2>
          <p>Your payment for order <strong>#${escapeHtml(order.order_number)}</strong> has been confirmed.</p>
          <p>Your PDF receipt is attached to this email.</p>
          <p style="margin-top: 24px;">Pedigree Leather<br />Handcrafted in Nairobi</p>
        </div>
      `,
      attachments: [
        {
          filename: `Pedigree-Receipt-${order.order_number}.pdf`,
          content: pdf,
        },
      ],
    });

    if (error) {
      console.error("[receipt] Resend rejected the email:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("[receipt] Failed to generate or send receipt:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send receipt",
    };
  }
}
