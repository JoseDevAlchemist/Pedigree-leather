import Link from "next/link";
import { listZones } from "@/lib/actions/zones";
import { AdminZones } from "@/components/admin/AdminZones";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const zones = await listZones();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/settings?section=delivery" className="text-sm font-semibold underline underline-offset-4">Delivery and pickup settings</Link>
      <AdminZones zones={zones} />
    </div>
  );
}