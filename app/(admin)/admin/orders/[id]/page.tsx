import { notFound } from "next/navigation";
import { AdminOrderDetail } from "@/components/admin/AdminOrderDetail";
import { getOrderAdmin } from "@/lib/actions/orders-admin";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await getOrderAdmin(id).catch(() => null);
  if (!order) notFound();

  return <AdminOrderDetail order={order} />;
}