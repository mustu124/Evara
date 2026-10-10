"use client";

import { useSyncExternalStore } from "react";

export type CartLine = {
  /** Variant + chosen option values: different combinations are separate lines. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  options: { name: string; valueId: string; value: string }[];
  /** Display only. Prices are always re-read from the database on the server. */
  unitPrice: number;
  compareAtPrice: number | null;
  image: string | null;
  quantity: number;
};

export const MAX_LINE_QUANTITY = 50;
const STORAGE_KEY = "evara-cart-v1";
const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

export const cartKey = (variantId: string, valueIds: string[]) => [variantId, ...[...valueIds].sort()].join(":");

const clampQty = (n: number) => Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(Number(n) || 1)));

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .filter((l): l is CartLine => Boolean(l && typeof l.key === "string" && typeof l.variantId === "string"))
      .map((l) => ({ ...l, options: Array.isArray(l.options) ? l.options : [], quantity: clampQty(l.quantity) }));
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
