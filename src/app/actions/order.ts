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
};

export type CartReview = {
  ok: boolean;
  error?: string;
  lines: ReviewedLine[];
  subtotal: number;
  shipping: number;
  total: number;
  whatsappConfigured: boolean;
};

const reviewSchema = z.array(cartItemSchema.extend({ key: z.string().max(600) })).max(50);

/**
 * Re-prices the browser's cart from the database so the cart page always shows
 * current names, prices and availability. Advisory only: create_order() repeats
 * every check authoritatively when the order is placed.
 */
export async function reviewCart(input: unknown): Promise<CartReview> {
  const failed = (error: string): CartReview => ({
    ok: false, error, lines: [], subtotal: 0, shipping: 0, total: 0, whatsappConfigured: false,
  });
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return failed("Your cart could not be read. Please refresh the page.");
  const db = getPublicClient();
  if (!db) return failed("The store is not connected to its database yet.");

  const items = parsed.data;
  const [settings, variantsResult] = await Promise.all([
    fetchSettings(db),
    items.length
      ? db
          .from("product_variants")
          .select(
            `id, label, pack_quantity, price, compare_at_price, is_available, is_coming_soon,
             product:products!inner ( id, name, slug, is_coming_soon, track_inventory, stock_quantity,
               options:product_options ( id, name, values:product_option_values ( id, value, is_available, is_coming_soon ) ),
               images:product_images ( storage_path, option_value_id, sort_order ) )`,
          )
          .in("id", [...new Set(items.map((i) => i.variant_id))])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (variantsResult.error) return failed("We could not check your cart just now. Please try again.");

  const variants = new Map<string, any>(
    ((variantsResult.data as any[]) ?? []).map((v) => [v.id, { ...v, product: Array.isArray(v.product) ? v.product[0] : v.product }]),
  );
  const piecesNeeded = new Map<string, number>();
  let subtotal = 0;

  const lines = items.map((item): ReviewedLine => {
    const v = variants.get(item.variant_id);
    if (!v?.product) return { key: item.key, ok: false, message: "This product is no longer available." };
    const p = v.product;
    const base = {
      key: item.key,
      name: p.name as string,
      slug: p.slug as string,
      variantLabel: v.label as string,
      unitPrice: Number(v.price),
      compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
    };
    const images = [...(p.images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const image: string | null =
      (images.find((i: any) => i.option_value_id && item.option_value_ids.includes(i.option_value_id)) ?? images[0])
        ?.storage_path ?? null;

    if (p.is_coming_soon || !isVariantOrderable(v)) {
      return { ...base, image, ok: false, message: "Not available to order yet." };
    }
    const options: any[] = p.options ?? [];
    const chosen = options.map((o) => (o.values ?? []).find((val: any) => item.option_value_ids.includes(val.id)));
    if (chosen.some((c) => !c) || item.option_value_ids.length !== options.length) {
      return { ...base, image, ok: false, message: "Please remove this item and choose its options again." };
    }
    const blocked = chosen.find((c) => c.is_coming_soon || !c.is_available);
    if (blocked) return { ...base, image, ok: false, message: `"${blocked.value}" is not available to order yet.` };

    if (p.track_inventory) {
      const need = (piecesNeeded.get(p.id) ?? 0) + item.quantity * v.pack_quantity;
      piecesNeeded.set(p.id, need);
      if (need > p.stock_quantity) {
        return {
          ...base, image, ok: false,
          message: p.stock_quantity === 0 ? "Currently out of stock." : `Only ${p.stock_quantity} piece(s) in stock.`,
        };
      }
    }
    subtotal += Number(v.price) * item.quantity;
    return { ...base, image, ok: true };
  });

  const { store } = settings;
  const allOk = lines.every((l) => l.ok);
  const shipping =
    !allOk || subtotal === 0 || (store.free_shipping_above !== null && subtotal >= store.free_shipping_above)
      ? 0
      : store.shipping_fee;

  return {
    ok: true,
    lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    whatsappConfigured: Boolean(buildWhatsAppUrl(resolveWhatsAppNumber(store))),
  };
}

export type PlaceOrderResult =
  | { ok: true; reference: string; total: number; whatsappUrl: string; message: string }
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
  const salt = process.env.ORDER_RATE_LIMIT_SALT ?? "evara";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Creates a PENDING, UNPAID order and returns the WhatsApp link the customer
 * uses to send it. Nothing from the browser is trusted beyond ids, quantities
 * and contact details: the database function recalculates everything.
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
    return {
      ok: false,
      code: "not_configured",
      error: "Ordering is not set up yet. Please contact us directly to place your order.",
    };
  }

  const { store } = await fetchSettings(service);
  const number = resolveWhatsAppNumber(store);
  if (!buildWhatsAppUrl(number)) {
    return {
      ok: false,
      code: "not_configured",
      error: "WhatsApp ordering is not available yet. Please contact us directly to place your order.",
    };
  }

  const phone = normalizeIndianMobile(customer.phone)!;
  const { data, error } = await service.rpc("create_order", {
    p_customer: { ...customer, phone },
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
    reference: string; subtotal: number; shipping_amount: number; total: number; items: OrderItem[];
  };
  const message = buildOrderMessage({
    reference: order.reference,
    customer: { ...customer, phone: `+91 ${phone}` },
    items: order.items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      quantity: Number(i.quantity),
    })),
    subtotal: Number(order.subtotal),
    shipping_amount: Number(order.shipping_amount),
    total: Number(order.total),
  });

  return {
    ok: true,
    reference: order.reference,
    total: Number(order.total),
    whatsappUrl: buildWhatsAppUrl(number, message)!,
    message,
  };
}
