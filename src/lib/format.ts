import { supabaseUrl } from "@/lib/env";
import type { ProductSummary, Variant } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** ₹1,080 — whole rupees show no decimals. */
export function formatINR(amount: number): string {
  const n = Number(amount) || 0;
  return `₹${inr.format(Number.isInteger(n) ? n : Number(n.toFixed(2)))}`;
}

/** Public URL for a stored image reference of the form "<bucket>/<path>". */
export function imageUrl(ref: string | null | undefined): string | null {
  if (!ref || !supabaseUrl) return null;
  if (/^https?:\/\//.test(ref)) return ref;
  return `${supabaseUrl}/storage/v1/object/public/${ref.split("/").map(encodeURIComponent).join("/")}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export const isVariantOrderable = (v: Pick<Variant, "is_available" | "is_coming_soon">) =>
  v.is_available && !v.is_coming_soon;

export type Availability = "available" | "coming_soon" | "out_of_stock" | "unavailable";

type AvailabilityInput = Pick<ProductSummary, "is_coming_soon" | "track_inventory" | "stock_quantity"> & {
  variants: Pick<Variant, "is_available" | "is_coming_soon" | "pack_quantity">[];
};

/** Single definition of whether a product can currently be ordered. */
export function productAvailability(p: AvailabilityInput): Availability {
  if (p.is_coming_soon) return "coming_soon";
  const orderable = p.variants.filter(isVariantOrderable);
  if (orderable.length === 0) {
    return p.variants.some((v) => v.is_coming_soon) ? "coming_soon" : "unavailable";
  }
  if (p.track_inventory && p.stock_quantity < Math.min(...orderable.map((v) => v.pack_quantity))) {
    return "out_of_stock";
  }
  return "available";
}

/** Lowest current price, preferring variants that can be ordered. */
export function startingPrice<V extends Pick<Variant, "price" | "is_available" | "is_coming_soon">>(
  variants: V[],
): V | null {
  if (variants.length === 0) return null;
  const pool = variants.some(isVariantOrderable) ? variants.filter(isVariantOrderable) : variants;
  return pool.reduce((min, v) => (v.price < min.price ? v : min));
}
