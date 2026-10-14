import { requireAdminUser } from "@/lib/supabase/guards";
import { listZones } from "@/lib/actions/zones";
import { AdminZones } from "@/components/admin/AdminZones";
import { notFound } from "next/navigation";

export default async function AdminZonesPage() {
  const user = await requireAdminUser();

  // Only owners can access zones
  if (user.role !== "owner") {
    notFound();
  }

  const zones = await listZones();

  return <AdminZones zones={zones} />;
}