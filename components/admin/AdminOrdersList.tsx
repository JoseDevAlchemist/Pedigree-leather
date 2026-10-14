"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, FormEvent } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Truck,
  Package,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

import { formatPrice } from "@/lib/format";
import { getStatusLabel, getStatusColor } from "@/lib/order-status-labels";
import { updateOrderStatusAction } from "@/lib/actions/orders-admin";
import { useToast } from "@/components/admin/Toast";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "paid", label: "Paid" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_delivery", label: "Ready for delivery" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total: number;
  delivery_method: "delivery" | "pickup";
  created_at: string;
}

interface AdminOrdersListProps {
  initialOrders: Order[];
  initialTotal: number;
  initialStatus: string;
  initialSearch: string;
  initialPage: number;
}

export function AdminOrdersList({
  initialOrders,
  initialTotal,
  initialStatus,
  initialSearch,
  initialPage,
}: AdminOrdersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / 20);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", page.toString());

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to fetch orders");

      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
    } catch (error) {
      console.error("[AdminOrdersList] Fetch error:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  // Sync with URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    if (page > 1) params.set("page", page.toString());
    router.replace(`/admin/orders?${params.toString()}`, { scroll: false });
  }, [status, search, page, router]);

  // Initial load from props (server-rendered)
  useEffect(() => {
    setOrders(initialOrders);
    setTotal(initialTotal);
    setStatus(initialStatus);
    setSearch(initialSearch);
    setPage(initialPage);
  }, [initialOrders, initialTotal, initialStatus, initialSearch, initialPage]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSearch(formData.get("search") as string);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("status", newStatus);

    const result = await updateOrderStatusAction(formData);
    setUpdatingId(null);

    if (result.ok) {
      toast.success("Status updated");
      fetchOrders();
    } else {
      toast.error("Failed to update status", result.error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Orders
          </h1>
          <p className="text-sm text-muted">
            {total} order{total !== 1 ? "s" : ""} total
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <label htmlFor="order-search" className="sr-only">
              Search orders
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" aria-hidden="true" />
              <input
                type="search"
                id="order-search"
                name="search"
                placeholder="Search by order #, name, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setPage(1);
                  }
                }}
                className="w-full sm:w-64 rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </form>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 text-primary animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Package className="size-12 text-muted/50" aria-hidden="true" />
            <h2 className="mt-4 font-serif text-lg font-semibold text-foreground">
              No orders found
            </h2>
            <p className="mt-2 text-sm text-muted">
              {search || status !== "all"
                ? "Try adjusting your filters"
                : "Orders will appear here when customers place them"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">
                      Order
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden sm:table-cell">
                      Delivery
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-sm text-muted">
                      Total
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden md:table-cell">
                      Date
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-sm text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono text-sm font-medium text-foreground hover:text-accent"
                        >
                          #{order.order_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <p className="text-sm text-muted">{order.customer_phone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            order.delivery_method === "delivery"
                              ? "bg-primary/10 text-primary"
                              : "bg-accent/10 text-accent"
                          }`}
                        >
                          {isDeliveryMethodIcon(order.delivery_method)}
                          {order.delivery_method === "delivery" ? "Delivery" : "Pickup"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={order.status} isDelivery={order.delivery_method === "delivery"} />
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground">
                        {formatPrice(order.total)}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-sm text-muted">
                        {new Date(order.created_at).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-primary/10 hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1 || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-sm text-foreground hover:bg-background/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-sm text-foreground hover:bg-background/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, isDelivery }: { status: string; isDelivery: boolean }) {
  const label = getStatusLabel(status, isDelivery);
  const color = getStatusColor(status);

  const bg = `${color}/10`;
  const text = color;
  const border = `${color}/30`;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${bg} ${text} ${border}`}
    >
      {label}
    </span>
  );
}

function isDeliveryMethodIcon(method: "delivery" | "pickup") {
  return method === "delivery" ? <Truck size={10} aria-hidden="true" /> : <Package size={10} aria-hidden="true" />;
}