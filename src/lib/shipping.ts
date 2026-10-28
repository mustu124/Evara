import type { StoreSettings } from "@/lib/types";

/** Weight charged for: the order's total weight rounded up to the next whole kg. */
export function chargeableKg(grams: number): number {
  return grams > 0 ? Math.ceil(grams / 1000) : 0;
}

/** The per-kg rate for a delivery state: one rate within the seller's state, another for every other state. */
export function shippingRate(store: Pick<StoreSettings, "seller_state" | "shipping_rate_intra_per_kg" | "shipping_rate_inter_per_kg">, intraState: boolean): number {
  return intraState ? store.shipping_rate_intra_per_kg : store.shipping_rate_inter_per_kg;
}

/**
 * The GST-inclusive shipping charge, worked out the same way as create_order()
 * in the database: chargeable kg x the rate for the delivery state, or nothing
 * once the order reaches the free-shipping amount.
 */
export function shippingCharge(input: { grams: number; ratePerKg: number; subtotal: number; freeShippingAbove: number | null }): number {
  if (input.subtotal <= 0) return 0;
  if (input.freeShippingAbove !== null && input.subtotal >= input.freeShippingAbove) return 0;
  return chargeableKg(input.grams) * input.ratePerKg;
}

/** 250 -> "250 g", 1500 -> "1.5 kg". */
export function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  return `${Number((grams / 1000).toFixed(2))} kg`;
}
