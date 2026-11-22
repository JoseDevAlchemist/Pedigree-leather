import { getOrderById } from "@/lib/orders-api";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const privateResponse = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  console.log("[API /orders/[orderId]] Fetching order:", orderId);

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    console.log("[API /orders/[orderId]] Invalid UUID:", orderId);
    return NextResponse.json({ error: "Invalid order ID" }, { ...privateResponse, status: 400 });
  }

  try {
    const order = await getOrderById(orderId);

    if (!order) {
      console.log("[API /orders/[orderId]] Order not found:", orderId);
      notFound();
    }

    console.log("[API /orders/[orderId]] Order fetched:", order.order_number);
    return NextResponse.json(order, privateResponse);
  } catch (error) {
    console.error("[API /orders/[orderId]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { ...privateResponse, status: 500 });
  }
}