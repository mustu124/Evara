"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { fetchSettings, resolveWhatsAppNumber } from "@/lib/data/settings";
import { isVariantOrderable } from "@/lib/format";
import { getPublicClient } from "@/lib/supabase/public";
import { getServiceClient } from "@/lib/supabase/service";
import type { OrderItem } from "@/lib/types";
import { cartItemSchema, normalizeIndianMobile, orderRequestSchema } from "@/lib/validation";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows */

export type ReviewedLine = {
  key: string;
  ok: boolean;
  message?: string;
  name?: string;
  slug?: string;
  variantLabel?: string;
  unitPrice?: number;
  compareAtPrice?: number | null;
  image?: string | null;
  /** GST % included in this line's price. */
  gstRate?: number;
};

export type CartReview = {
  ok: boolean;
  error?: string;
  lines: ReviewedLine[];
  subtotal: number;
  shipping: number;
  /** GST % included in the shipping charge (the highest rate among the items). */
  shippingGstRate: number;
  total: number;
  sellerState: string;
  whatsappConfigured: boolean;
};

const reviewSchema = z.array(cartItemSchema.extend({ key: z.string().max(4000) })).max(50);

const VARIANT_SELECT = (withTax: boolean) =>
  `id, label, pack_quantity, price, compare_at_price, is_available, is_coming_soon,
   product:products!inner ( id, name, slug, is_coming_soon, track_inventory, stock_quantity${withTax ? ", gst_rate" : ""},
     options:product_options ( id, name, values:product_option_values ( id, value, is_available, is_coming_soon ) ),
     images:product_images ( storage_path, option_value_id, sort_order ) )`;

/**
 * Re-prices the browser's cart from the database so the cart page always shows
 * current names, prices and availability. Advisory only: create_order() repeats
 * every check authoritatively when the order is placed.
 */
export async function reviewCart(input: unknown): Promise<CartReview> {
  const failed = (error: string): CartReview => ({
    ok: false, error, lines: [], subtotal: 0, shipping: 0, shippingGstRate: 0, total: 0, sellerState: "", whatsappConfigured: false,
  });
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return failed("Your cart could not be read. Please refresh the page.");
  const db = getPublicClient();
  if (!db) return failed("The store is not connected to its database yet.");

  const items = parsed.data;
  const ids = [...new Set(items.map((i) => i.variant_id))];
  const loadVariants = async () => {
    if (!ids.length) return { data: [] as any[], error: null };
    const first = await db.from("product_variants").select(VARIANT_SELECT(true)).in("id", ids);
    // A database that has not had migration 0003 applied yet has no gst_rate column.
    if (first.error?.code === "42703") return db.from("product_variants").select(VARIANT_SELECT(false)).in("id", ids);
    return first;
  };
  const [settings, variantsResult] = await Promise.all([fetchSettings(db), loadVariants()]);
  if (variantsResult.error) return failed("We could not check your cart just now. Please try again.");

  const { store } = settings;
  const variants = new Map<string, any>(
    ((variantsResult.data as any[]) ?? []).map((v) => [v.id, { ...v, product: Array.isArray(v.product) ? v.product[0] : v.product }]),
  );
  const piecesNeeded = new Map<string, number>();
  let subtotal = 0;
  let maxRate = 0;

  const lines = items.map((item): ReviewedLine => {
    const v = variants.get(item.variant_id);
    if (!v?.product) return { key: item.key, ok: false, message: "This product is no longer available." };
    const p = v.product;
    const gstRate = p.gst_rate === null || p.gst_rate === undefined ? store.default_gst_rate : Number(p.gst_rate);
    const chosenIds = item.units.flat();
    const images = [...(p.images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const base = {
      key: item.key,
      name: p.name as string,
      slug: p.slug as string,
      variantLabel: v.label as string,
      unitPrice: Number(v.price),
      compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
      image: ((images.find((i: any) => i.option_value_id && chosenIds.includes(i.option_value_id)) ?? images[0])?.storage_path ?? null) as string | null,
      gstRate,
    };

    if (p.is_coming_soon || !isVariantOrderable(v)) return { ...base, ok: false, message: "Not available to order yet." };

    // Every candle in the pack needs exactly one available value for every option.
    const options: any[] = p.options ?? [];
    if (item.units.length !== v.pack_quantity) {
      return { ...base, ok: false, message: "Please remove this item and choose its options again." };
    }
    for (const [n, unit] of item.units.entries()) {
      const chosen = options.map((o) => (o.values ?? []).find((val: any) => unit.includes(val.id)));
      if (chosen.some((c) => !c) || unit.length !== options.length) {
        return { ...base, ok: false, message: "Please remove this item and choose its options again." };
      }
      const blocked = chosen.find((c) => c.is_coming_soon || !c.is_available);
      if (blocked) {
        const which = v.pack_quantity > 1 ? `Candle ${n + 1}: ` : "";
        return { ...base, ok: false, message: `${which}"${blocked.value}" is not available to order yet.` };
      }
    }

    if (p.track_inventory) {
      const need = (piecesNeeded.get(p.id) ?? 0) + item.quantity * v.pack_quantity;
      piecesNeeded.set(p.id, need);
      if (need > p.stock_quantity) {
        return { ...base, ok: false, message: p.stock_quantity === 0 ? "Currently out of stock." : `Only ${p.stock_quantity} piece(s) in stock.` };
      }
    }
    subtotal += Number(v.price) * item.quantity;
    maxRate = Math.max(maxRate, gstRate);
    return { ...base, ok: true };
  });

  // One flat shipping charge per order, however many items or quantities it holds.
  const shipping = subtotal === 0 || (store.free_shipping_above !== null && subtotal >= store.free_shipping_above) ? 0 : store.shipping_fee;

  return {
    ok: true,
    lines,
    subtotal,
    shipping,
    shippingGstRate: maxRate,
    total: subtotal + shipping,
    sellerState: store.seller_state,
    whatsappConfigured: Boolean(buildWhatsAppUrl(resolveWhatsAppNumber(store))),
  };
}

export type OrderInvoice = {
  subtotal: number;
  shipping: number;
  total: number;
  intraState: boolean;
  rate: number | null;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type PlaceOrderResult =
  | { ok: true; reference: string; total: number; whatsappUrl: string; message: string; invoice: OrderInvoice }
  | {
      ok: false;
      code: "validation" | "not_configured" | "invalid_items" | "rate_limited" | "error";
      error: string;
      /** Per-line problems, indexed like the submitted items. */
      itemErrors?: { index: number; message: string }[];
    };

async function clientHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (!ip) return null;
  // Stored only as a hash, and only to count recent orders from the same address.
  return createHash("sha256").update(`evara-orders:${ip}`).digest("hex");
}

/**
 * Creates a PENDING, UNPAID order and returns the WhatsApp link the customer
 * uses to send it. Nothing from the browser is trusted beyond ids, quantities
 * and contact details: the database function recalculates prices, GST and
 * shipping.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { customer, items, website } = parsed.data;
  if (website) return { ok: false, code: "error", error: "We could not place your order. Please try again." };

  const service = getServiceClient();
  if (!service) {
    return { ok: false, code: "not_configured", error: "Ordering is not set up yet. Please contact us directly to place your order." };
  }

  const { store } = await fetchSettings(service);
  const number = resolveWhatsAppNumber(store);
  if (!buildWhatsAppUrl(number)) {
    return { ok: false, code: "not_configured", error: "WhatsApp ordering is not available yet. Please contact us directly to place your order." };
  }

  const phone = normalizeIndianMobile(customer.phone)!;
  const gstin = customer.gstin.trim().toUpperCase();
  const { data, error } = await service.rpc("create_order", {
    p_customer: { ...customer, phone, gstin },
    p_items: items,
    p_client_hash: await clientHash(),
  });
  if (error || !data) {
    console.error("[order] create_order failed:", error?.message);
    return { ok: false, code: "error", error: "We could not place your order just now. Please try again." };
  }

  const result = data as any;
  if (!result.ok) {
    return {
      ok: false,
      code: result.code === "rate_limited" ? "rate_limited" : "invalid_items",
      error: result.message ?? "Some items in your cart need attention.",
      itemErrors: result.errors,
    };
  }

  const order = result.order as {
    reference: string; subtotal: number; shipping_amount: number; total: number; items: (OrderItem & { gst_rate?: number })[];
    tax_type?: string; taxable_value?: number; cgst_amount?: number; sgst_amount?: number; igst_amount?: number; shipping_gst_rate?: number;
  };
  // Present only once migration 0003 has been applied to the database.
  const hasTax = typeof order.tax_type === "string";
  const rates = [...new Set(order.items.map((i) => Number(i.gst_rate ?? 0)))];
  if (Number(order.shipping_amount) > 0) rates.push(Number(order.shipping_gst_rate ?? 0));
  const distinct = [...new Set(rates)];
  const invoice: OrderInvoice = {
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping_amount),
    total: Number(order.total),
    intraState: order.tax_type === "intra_state",
    rate: distinct.length === 1 ? distinct[0] : null,
    taxable: Number(order.taxable_value ?? 0),
    cgst: Number(order.cgst_amount ?? 0),
    sgst: Number(order.sgst_amount ?? 0),
    igst: Number(order.igst_amount ?? 0),
  };

  const message = buildOrderMessage({
    reference: order.reference,
    customer: { ...customer, phone: `+91 ${phone}`, gstin: gstin || null },
    items: order.items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      quantity: Number(i.quantity),
      pack_quantity: Number(i.pack_quantity),
    })),
    subtotal: invoice.subtotal,
    shipping_amount: invoice.shipping,
    total: invoice.total,
    tax: hasTax
      ? { intra_state: invoice.intraState, rate: invoice.rate, taxable_value: invoice.taxable, cgst: invoice.cgst, sgst: invoice.sgst, igst: invoice.igst }
      : undefined,
  });

  return {
    ok: true,
    reference: order.reference,
    total: invoice.total,
    whatsappUrl: buildWhatsAppUrl(number, message)!,
    message,
    invoice,
  };
}
