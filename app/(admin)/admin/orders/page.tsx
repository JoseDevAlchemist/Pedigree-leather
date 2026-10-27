import { AdminOrdersList } from "@/components/admin/AdminOrdersList";
import { getOrdersAdmin } from "@/lib/actions/orders-admin";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "all";
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);

  const { orders, total } = await getOrdersAdmin({ status, search, page });

  return (
    <AdminOrdersList
      key={`${status}-${search}-${page}`}
      initialOrders={orders}
      initialTotal={total}
      initialStatus={status}
      initialSearch={search}
      initialPage={page}
    />
  );
}