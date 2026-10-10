"use client";

import { useSyncExternalStore } from "react";

export type CartChoice = { name: string; valueId: string; value: string };

export type CartLine = {
  /** Variant + the choices for every candle: different combinations are separate lines. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  /** One list of choices per candle in the pack (a Set of 2 has two lists). */
  units: CartChoice[][];
  /** Display only. Prices are always re-read from the database on the server. */
  unitPrice: number;
  compareAtPrice: number | null;
  image: string | null;
  quantity: number;
};

export const MAX_LINE_QUANTITY = 50;
// v2: lines carry per-candle choices. Carts saved in the older shape are dropped.
const STORAGE_KEY = "evara-cart-v2";
const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/** The same candles in a different order are the same set, so candles are sorted before keying. */
export const cartKey = (variantId: string, unitValueIds: string[][]) =>
  [variantId, ...unitValueIds.map((ids) => [...ids].sort().join("+")).sort()].join(":");

const clampQty = (n: number) => Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(Number(n) || 1)));

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .filter((l): l is CartLine => Boolean(l && typeof l.key === "string" && typeof l.variantId === "string" && Array.isArray(l.units)))
      .map((l) => ({ ...l, units: l.units.map((u) => (Array.isArray(u) ? u : [])), quantity: clampQty(l.quantity) }));
  } catch {
    return EMPTY;
  }
}

function commit(next: CartLine[]) {
  lines = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode / quota): the cart still works for this page view.
  }
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  lines = read();
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    lines = read();
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return lines;
}

export const cart = {
  add(line: CartLine) {
    ensureLoaded();
    const existing = lines.find((l) => l.key === line.key);
    commit(
      existing
        ? lines.map((l) => (l.key === line.key ? { ...line, quantity: clampQty(l.quantity + line.quantity) } : l))
        : [...lines, { ...line, quantity: clampQty(line.quantity) }],
    );
  },
  setQuantity(key: string, quantity: number) {
    commit(lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity) } : l)));
  },
  remove(key: string) {
    commit(lines.filter((l) => l.key !== key));
  },
  /** Apply server-confirmed names and prices to stored lines. */
  patch(updates: Map<string, Partial<CartLine>>) {
    let changed = false;
    const next = lines.map((l) => {
      const u = updates.get(l.key);
      if (!u) return l;
      const merged = { ...l, ...u };
      if (JSON.stringify(merged) !== JSON.stringify(l)) changed = true;
      return merged;
    });
    if (changed) commit(next);
  },
  clear() {
    commit(EMPTY);
  },
};

/** Cart lines; empty during server rendering and hydration. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export const cartCount = (items: CartLine[]) => items.reduce((n, l) => n + l.quantity, 0);
