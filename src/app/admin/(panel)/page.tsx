import type { Metadata } from "next";
import Link from "next/link";
import { AdminEmpty, AdminHeading, LoadError, OrderStatusBadge, PaymentBadge } from "@/components/admin/bits";
import { Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

type Stats = {
  total_products: number;
  active_products: number;
  low_stock_products: number;
  total_orders: number;
  pending_orders: number;
  paid_revenue: number;
  paid_revenue_30d: number;
  awaiting_payment: number;
  pending_value: number;
};

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-cocoa">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-ivory p-5 shadow-soft";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-blush`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const [statsResult, ordersResult, lowStockResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("orders")
      .select("id, reference, status, payment_status, customer_name, total, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold")
      .eq("track_inventory", true)
      .neq("status", "archived")
      .order("stock_quantity")
      .limit(50),
  ]);

  if (statsResult.error) {
    return (
      <>
        <AdminHeading title="Overview" />
        <LoadError message={statsResult.error.message} />
      </>
    );
  }
  const stats = statsResult.data as Stats;
  const orders = (ordersResult.data ?? []) as Pick<Order, "id" | "reference" | "status" | "payment_status" | "customer_name" | "total" | "created_at">[];
  const lowStock = (lowStockResult.data ?? []).filter((p) => p.stock_quantity <= p.low_stock_threshold).slice(0, 8);

  return (
    <>
      <AdminHeading title="Overview" description="A snapshot of your catalog and orders." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total products" value={stats.total_products} hint="Excluding archived" href="/admin/products" />
        <Stat label="Active products" value={stats.active_products} hint="Published on the store" href="/admin/products?status=published" />
        <Stat label="Total orders" value={stats.total_orders} href="/admin/orders" />
        <Stat label="Pending orders" value={stats.pending_orders} hint="Awaiting your confirmation" href="/admin/orders?status=pending" />
        <Stat label="Low-stock products" value={stats.low_stock_products} hint="Tracked products at or below threshold" href="/admin/inventory" />
        <Stat label="Revenue (paid)" value={formatINR(Number(stats.paid_revenue))} hint={`${formatINR(Number(stats.paid_revenue_30d))} in the last 30 days`} />
        <Stat label="Awaiting payment" value={formatINR(Number(stats.awaiting_payment))} hint="Confirmed orders not yet marked paid" href="/admin/orders?payment=unpaid" />
        <Stat label="Pending requests" value={formatINR(Number(stats.pending_value))} hint="Unconfirmed; not counted as revenue" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm text-copper underline underline-offset-4">View all</Link>}>
          {orders.length === 0 ? (
            <AdminEmpty title="No orders yet" body="Orders placed through the store will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:text-copper">
                    <span>
                      <span className="font-medium">{o.reference}</span>
                      <span className="block text-xs text-muted">{o.customer_name} · {formatDate(o.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <OrderStatusBadge status={o.status} />
                      <PaymentBadge status={o.payment_status} />
                      <span className="w-20 text-right font-medium">{formatINR(Number(o.total))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Low stock" actions={<Link href="/admin/inventory" className="text-sm text-copper underline underline-offset-4">Inventory</Link>}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted">No tracked products are running low.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="hover:text-copper">{p.name}</Link>
                  <span className={p.stock_quantity === 0 ? "font-semibold text-cocoa" : "font-medium text-copper-dark"}>{p.stock_quantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
