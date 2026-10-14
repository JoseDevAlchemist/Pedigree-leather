import { getOrdersAdmin } from "@/lib/actions/orders-admin";
import { requireRole } from "@/lib/roles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireRole("worker");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);

    const { orders, total } = await getOrdersAdmin({ status, search, page });

    return NextResponse.json({ orders, total });
  } catch (error) {
    console.error("[API /admin/orders] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}