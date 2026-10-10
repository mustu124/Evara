import type { Metadata } from "next";
import Link from "next/link";
import { AdminEmpty, AdminHeading, LoadError, ORDER_STATUSES, OrderStatusBadge, PAYMENT_STATUSES, PaymentBadge } from "@/components/admin/bits";
import { adminInput, btnSecondary } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;
type Params = { q?: string; status?: string; payment?: string; page?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").replace(/[^\p{L}\p{N}\s@.+-]/gu, " ").trim().slice(0, 80);
  const status = ORDER_STATUSES.find((s) => s.value === params.status)?.value;
  const payment = PAYMENT_STATUSES.find((s) => s.value === params.payment)?.value;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  let request = supabase
    .from("orders")
    .select("id, reference, status, payment_status, customer_name, customer_phone, city, total, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) request = request.eq("status", status);
  if (payment) request = request.eq("payment_status", payment);
  if (q) {
    const like = `%${q.replace(/\s+/g, "%")}%`;
    request = request.or(`reference.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`);
  }
  const { data, error, count } = await request;
  const orders = (data ?? []) as Pick<Order, "id" | "reference" | "status" | "payment_status" | "customer_name" | "customer_phone" | "city" | "total" | "created_at">[];
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filtered = Boolean(q || status || payment);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (payment) sp.set("payment", payment);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <>
      <AdminHeading title="Orders" description="Orders start as Pending and Unpaid when a customer sends a request. Confirm them once you have agreed the details on WhatsApp." />

      <form method="get" className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <div>
          <label htmlFor="q" className="sr-only">Search orders</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Reference, name or phone" className={adminInput} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">Order status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment" className="sr-only">Payment status</label>
          <select id="payment" name="payment" defaultValue={payment ?? ""} className={adminInput}>
            <option value="">Any payment</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={btnSecondary}>Filter</button>
      </form>

      {error ? (
        <LoadError message={error.message} />
      ) : orders.length === 0 ? (
        <AdminEmpty title={filtered ? "No orders match" : "No orders yet"} body={filtered ? "Try a different search or filter." : "When a customer sends an order from the store, it will appear here."}>
          {filtered && <Link href="/admin/orders" className={btnSecondary}>Clear filters</Link>}
        </AdminEmpty>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{count} order{count === 1 ? "" : "s"}</p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-ivory shadow-soft">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="grid gap-x-4 gap-y-1 p-4 transition-colors hover:bg-blush/20 sm:grid-cols-[1.1fr_1.2fr_auto_5.5rem] sm:items-center">
                  <span>
                    <span className="font-medium text-cocoa">{o.reference}</span>
                    <span className="block text-xs text-muted">{formatDate(o.created_at)}</span>
                  </span>
                  <span className="text-sm">
                    {o.customer_name}
                    <span className="block text-xs text-muted">{o.customer_phone} · {o.city}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    <PaymentBadge status={o.payment_status} />
                  </span>
                  <span className="font-medium sm:text-right">{formatINR(Number(o.total))}</span>
                </Link>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? <Link href={href(page - 1)} className={btnSecondary}>Previous</Link> : <span className={`${btnSecondary} opacity-40`}>Previous</span>}
              <span className="text-muted">Page {page} of {pageCount}</span>
              {page < pageCount ? <Link href={href(page + 1)} className={btnSecondary}>Next</Link> : <span className={`${btnSecondary} opacity-40`}>Next</span>}
            </nav>
          )}
        </>
      )}
    </>
  );
}
