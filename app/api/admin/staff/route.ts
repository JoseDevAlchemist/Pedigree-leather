import { getAllStaff, createStaffAction, updateStaffAction, deleteStaffAction } from "@/lib/actions/staff";
import { requireRole } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole("owner");
    const staff = await getAllStaff();
    return NextResponse.json({ staff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("owner");
    const formData = await request.formData();
    const result = await createStaffAction(formData);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole("owner");
    const formData = await request.formData();
    const result = await updateStaffAction(formData);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("owner");
    const formData = await request.formData();
    const result = await deleteStaffAction(formData);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}