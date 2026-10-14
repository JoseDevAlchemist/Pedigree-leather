import { requireAdminUser } from "@/lib/supabase/guards";
import { getShopSettings } from "@/lib/settings-api";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { notFound } from "next/navigation";

export default async function AdminSettingsPage() {
  const user = await requireAdminUser();
  
  // Only owners can access settings
  if (user.role !== "owner") {
    notFound();
  }

  const settings = await getShopSettings();

  return <AdminSettings settings={settings} />;
}