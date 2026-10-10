import { formatINR } from "@/lib/format";
import type { OrderItem } from "@/lib/types";

export type WhatsAppOrder = {
  reference: string;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    note?: string | null;
  };
  items: Pick<OrderItem, "product_name" | "variant_label" | "selected_options" | "unit_price" | "quantity" | "line_total">[];
  subtotal: number;
  shipping_amount: number;
  total: number;
};

/** The prefilled message a customer sends to the business. Built on the server from the stored order. */
export function buildOrderMessage(order: WhatsAppOrder): string {
  const { customer: c } = order;
  const lines: string[] = [
    "Hello Evara Studios! I would like to place this order.",
    "",
    `*Order reference:* ${order.reference}`,
    "",
    "*Customer*",
    `Name: ${c.name}`,
    `Phone: ${c.phone}`,
  ];
  if (c.email) lines.push(`Email: ${c.email}`);

  lines.push("", "*Items*");
  order.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.product_name}`);
    lines.push(`   Pack size: ${item.variant_label}`);
    for (const o of item.selected_options) lines.push(`   ${o.name}: ${o.value}`);
    lines.push(`   Qty: ${item.quantity} x ${formatINR(item.unit_price)} = ${formatINR(item.line_total)}`);
  });

  lines.push("", `Subtotal: ${formatINR(order.subtotal)}`);
  if (order.shipping_amount > 0) lines.push(`Shipping: ${formatINR(order.shipping_amount)}`);
  lines.push(`*Total: ${formatINR(order.total)}*`);
  if (order.shipping_amount === 0) lines.push("(Shipping, if any, to be confirmed)");

  lines.push("", "*Delivery address*", c.address_line1);
  if (c.address_line2) lines.push(c.address_line2);
  lines.push(`${c.city}, ${c.state} - ${c.pincode}`);
  if (c.note) lines.push("", `Note: ${c.note}`);

  return lines.join("\n");
}

/** https://wa.me/PHONE?text=ENCODED — returns null when no valid number is configured. */
export function buildWhatsAppUrl(phone: string, message?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
