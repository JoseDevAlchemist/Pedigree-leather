import { createPublicClient } from "@/lib/supabase/public";
import { NextResponse } from "next/server";

const freshResponse = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("delivery_zones")
      .select("id, name, fee")
      .eq("active", true)
      .order("sort_order", { ascending: true }).order("name");

    if (error) throw new Error(error.message);

    return NextResponse.json(data || [], freshResponse);
  } catch {
    return NextResponse.json({ error: "Delivery zones are unavailable." }, { ...freshResponse, status: 503 });
  }
}