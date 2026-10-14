import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}