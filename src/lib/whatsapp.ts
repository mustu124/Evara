import { formatINR, groupByCandle } from "@/lib/format";
import { formatRate } from "@/lib/gst";
import type { OrderItem } from "@/lib/types";

export type WhatsAppOrder = {
  reference: string;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    gstin?: string | null;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    note?: string | null;
  };
  items: Pick<OrderItem, "product_name" | "variant_label" | "pack_quantity" | "selected_options" | "unit_price" | "quantity" | "line_total">[];
  subtotal: number;
  shipping_amount: number;
  total: number;
  /** GST already included in the total, as stored with the order. */
  tax?: { intra_state: boolean; rate: number | null; taxable_value: number; cgst: number; sgst: number; igst: number };
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
  if (c.gstin) lines.push(`GSTIN: ${c.gstin}`);

  lines.push("", "*Items*");
  order.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.product_name}`);
    lines.push(`   Pack size: ${item.variant_label}`);
    const candles = groupByCandle(item.selected_options, item.pack_quantity);
    if (candles.length <= 1) {
      for (const o of candles[0] ?? []) lines.push(`   ${o.name}: ${o.value}`);
    } else {
      // Every candle in a set keeps its own choices.
      candles.forEach((choices, n) => lines.push(`   Candle ${n + 1}: ${choices.map((o) => `${o.name} ${o.value}`).join(", ")}`));
    }
    lines.push(`   Qty: ${item.quantity} x ${formatINR(item.unit_price)} = ${formatINR(item.line_total)}`);
  });

  lines.push("", `Subtotal: ${formatINR(order.subtotal)}`);
  lines.push(order.shipping_amount > 0 ? `Shipping: ${formatINR(order.shipping_amount)}` : "Shipping: to be confirmed");
  lines.push(`*Total: ${formatINR(order.total)}*`);

  if (order.tax) {
    const t = order.tax;
    const rate = (r: number | null, half = false) => (r === null ? "" : ` @ ${formatRate(half ? r / 2 : r)}%`);
    lines.push("", "*GST (included in the total)*", `Taxable value: ${formatINR(t.taxable_value)}`);
    if (t.intra_state) {
      lines.push(`CGST${rate(t.rate, true)}: ${formatINR(t.cgst)}`, `SGST${rate(t.rate, true)}: ${formatINR(t.sgst)}`);
    } else {
      lines.push(`IGST${rate(t.rate)}: ${formatINR(t.igst)}`);
    }
  }

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
