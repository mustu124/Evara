"use client";

import Link from "next/link";
import { useState } from "react";
import { updateInventory } from "@/app/admin/actions/catalog";
import { Badge, ProductStatusBadge } from "@/components/admin/bits";
import { adminInput, btnPrimary, Checkbox, Spinner, useAction } from "@/components/admin/ui";
import type { ProductStatus } from "@/lib/types";

export type InventoryRow = {
  id: string;
  name: string;
  status: ProductStatus;
  is_coming_soon: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
};

function Row({ product }: { product: InventoryRow }) {
  const { run, pending, result } = useAction();
  const [track, setTrack] = useState(product.track_inventory);
  const [stock, setStock] = useState(String(product.stock_quantity));
  const [threshold, setThreshold] = useState(String(product.low_stock_threshold));
  const [comingSoon, setComingSoon] = useState(product.is_coming_soon);

  const dirty =
    track !== product.track_inventory ||
    Number(stock) !== product.stock_quantity ||
    Number(threshold) !== product.low_stock_threshold ||
    comingSoon !== product.is_coming_soon;
  const low = product.track_inventory && product.stock_quantity <= product.low_stock_threshold;

  return (
    <li className="grid gap-3 p-4 lg:grid-cols-[1.4fr_auto_6.5rem_6.5rem_auto_auto] lg:items-center">
      <div className="min-w-0">
        <Link href={`/admin/products/${product.id}`} className="font-medium text-cocoa hover:text-copper">{product.name}</Link>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <ProductStatusBadge status={product.status} />
          {!product.track_inventory ? (
            <Badge>Not tracked</Badge>
          ) : product.stock_quantity === 0 ? (
            <Badge tone="red">Out of stock</Badge>
          ) : low ? (
            <Badge tone="amber">Low stock</Badge>
          ) : (
            <Badge tone="green">In stock</Badge>
          )}
        </div>
      </div>
      <Checkbox label="Track stock" checked={track} onChange={(e) => setTrack(e.target.checked)} />
      <div>
        <label htmlFor={`stock-${product.id}`} className="mb-1 block text-xs text-muted lg:sr-only">Pieces in stock</label>
        <input id={`stock-${product.id}`} type="number" min={0} value={stock} readOnly={!track} onChange={(e) => setStock(e.target.value)} className={adminInput} title="Pieces in stock" />
      </div>
      <div>
        <label htmlFor={`low-${product.id}`} className="mb-1 block text-xs text-muted lg:sr-only">Low-stock alert at</label>
        <input id={`low-${product.id}`} type="number" min={0} value={threshold} readOnly={!track} onChange={(e) => setThreshold(e.target.value)} className={adminInput} title="Low-stock alert at" />
      </div>
      <Checkbox label="Coming soon" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${btnPrimary} !min-h-9 !px-3 text-xs`}
          disabled={pending || !dirty}
          onClick={() =>
            run(() => updateInventory({ id: product.id, track_inventory: track, stock_quantity: stock, low_stock_threshold: threshold, is_coming_soon: comingSoon }), { success: "Saved" })
          }
        >
          {pending && <Spinner />} Save
        </button>
        {result && <span role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-copper-dark" : "font-medium text-cocoa"}`}>{result.message}</span>}
      </div>
    </li>
  );
}

export function InventoryTable({ products }: { products: InventoryRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-ivory shadow-soft">
      <div className="hidden grid-cols-[1.4fr_auto_6.5rem_6.5rem_auto_auto] gap-3 border-b border-line bg-blush-light/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted lg:grid" aria-hidden>
        <span>Product</span>
        <span className="w-28">Tracking</span>
        <span>In stock</span>
        <span>Alert at</span>
        <span className="w-32">Availability</span>
        <span className="w-24" />
      </div>
      <ul className="divide-y divide-line">
        {products.map((p) => (
          <Row key={`${p.id}:${p.track_inventory}:${p.stock_quantity}:${p.low_stock_threshold}:${p.is_coming_soon}`} product={p} />
        ))}
      </ul>
    </div>
  );
}
