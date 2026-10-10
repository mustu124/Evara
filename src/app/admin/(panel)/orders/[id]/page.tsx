import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeading, OrderStatusBadge, PaymentBadge } from "@/components/admin/bits";
import { OrderEditor } from "@/components/admin/order-editor";
import { btnSecondary, Panel } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatINR, imageUrl } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("orders").select("*, items:order_items ( * )").eq("id", id).maybeSingle();
  if (!data) notFound();
  const order = data as Order & { items: (OrderItem & { id: string; created_at: string })[] };
  const items = [...order.items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const customerChat = buildWhatsAppUrl(`91${order.customer_phone}`, `Hello ${order.customer_name}, this is Evara Studios regarding your order ${order.reference}.`);

  return (
    <>
      <AdminHeading title={`Order ${order.reference}`} description={`Placed ${formatDate(order.created_at)}`}>
        <Link href="/admin/orders" className={btnSecondary}>Back to orders</Link>
      </AdminHeading>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items" actions={<span className="flex gap-1.5"><OrderStatusBadge status={order.status} /><PaymentBadge status={order.payment_status} /></span>}>
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const src = imageUrl(item.image_path);
                return (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-blush">
                      {src && <Image src={src} alt="" fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-cocoa">{item.product_name}</p>
                      <dl className="mt-0.5 text-sm text-muted">
                        <div className="flex gap-1.5"><dt>Pack size:</dt><dd className="text-cocoa">{item.variant_label}</dd></div>
                        {item.selected_options.map((o) => (
                          <div key={o.name} className="flex gap-1.5"><dt>{o.name}:</dt><dd className="text-cocoa">{o.value}</dd></div>
                        ))}
                      </dl>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p>{item.quantity} × {formatINR(Number(item.unit_price))}</p>
                      <p className="font-medium text-cocoa">{formatINR(Number(item.line_total))}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-2 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatINR(Number(order.subtotal))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{Number(order.shipping_amount) > 0 ? formatINR(Number(order.shipping_amount)) : "Not charged"}</dd></div>
              <div className="flex justify-between text-base font-semibold text-cocoa"><dt>Total</dt><dd>{formatINR(Number(order.total))}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Prices are as they were when the order was placed.</p>
          </Panel>

          <OrderEditor id={order.id} status={order.status} paymentStatus={order.payment_status} adminNote={order.admin_note ?? ""} />
        </div>

        <Panel title="Customer">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Name</dt>
              <dd className="mt-0.5">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Phone</dt>
              <dd className="mt-0.5"><a href={`tel:+91${order.customer_phone}`} className="text-copper underline underline-offset-4">+91 {order.customer_phone}</a></dd>
            </div>
            {order.customer_email && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Email</dt>
                <dd className="mt-0.5 break-all"><a href={`mailto:${order.customer_email}`} className="text-copper underline underline-offset-4">{order.customer_email}</a></dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Delivery address</dt>
              <dd className="mt-0.5 whitespace-pre-line">
                {[order.address_line1, order.address_line2, `${order.city}, ${order.state} - ${order.pincode}`].filter(Boolean).join("\n")}
              </dd>
            </div>
            {order.customer_note && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Customer note</dt>
                <dd className="mt-0.5 whitespace-pre-line">{order.customer_note}</dd>
              </div>
            )}
          </dl>
          {customerChat && (
            <a href={customerChat} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} mt-5 w-full`}>
              <WhatsAppIcon className="size-4 text-whatsapp" /> Message customer
            </a>
          )}
        </Panel>
      </div>
    </>
  );
}
