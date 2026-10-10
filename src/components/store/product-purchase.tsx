"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { ArchOrnament, WhatsAppIcon } from "@/components/icons";
import { SaleBadge } from "@/components/store/product-card";
import { cart, cartKey, MAX_LINE_QUANTITY } from "@/lib/cart";
import { formatINR, imageUrl, isVariantOrderable, productAvailability } from "@/lib/format";
import type { OptionKind, ProductDetail } from "@/lib/types";

const pill = (selected: boolean, disabled: boolean) =>
  `choice ${disabled ? "choice-disabled" : selected ? "choice-selected" : ""}`;

// Customers choose in this order: design, colour, scent.
const KIND_ORDER: Record<OptionKind, number> = { design: 0, colour: 1, fragrance: 2, other: 3 };

/** Choices for one candle: option id -> chosen value id. */
type Choices = Record<string, string>;

const arrow =
  "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-ivory/90 text-cocoa shadow-soft transition-colors hover:border-copper hover:bg-ivory";

export function ProductPurchase({ product, children }: { product: ProductDetail; children?: React.ReactNode }) {
  const router = useRouter();
  const availability = productAvailability(product);
  const canOrder = availability === "available";
  const options = useMemo(
    () => [...product.options].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sort_order - b.sort_order),
    [product.options],
  );

  const [variantId, setVariantId] = useState(() => (product.variants.find(isVariantOrderable) ?? product.variants[0])?.id ?? "");
  // One entry per candle. Kept when the pack size changes, so nothing already chosen is lost.
  const [candles, setCandles] = useState<Choices[]>([{}]);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId);
  const packSize = variant?.pack_quantity ?? 1;
  const units = Array.from({ length: packSize }, (_, i) => candles[i] ?? {});
  const images = product.images;
  const image = images[Math.min(imageIndex, Math.max(0, images.length - 1))];
  const imageSrc = imageUrl(image?.storage_path);

  const maxQuantity = useMemo(() => {
    if (!variant || !product.track_inventory) return MAX_LINE_QUANTITY;
    return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(product.stock_quantity / variant.pack_quantity)));
  }, [variant, product.track_inventory, product.stock_quantity]);

  const variantOrderable = Boolean(variant && isVariantOrderable(variant) && maxQuantity > 0);
  const purchasable = canOrder && variantOrderable;
  const qty = Math.min(quantity, Math.max(1, maxQuantity));

  const choose = (unit: number, optionId: string, valueId: string) => {
    setCandles((prev) => {
      const next = Array.from({ length: Math.max(prev.length, unit + 1) }, (_, i) => prev[i] ?? {});
      next[unit] = { ...next[unit], [optionId]: valueId };
      return next;
    });
    setMissing((m) => m.filter((id) => id !== `${unit}:${optionId}`));
    setAdded(false);
    const linked = images.findIndex((i) => i.option_value_id === valueId);
    if (linked >= 0) setImageIndex(linked);
  };

  const copyFirstToAll = () => {
    setCandles(Array.from({ length: packSize }, () => ({ ...units[0] })));
    setMissing((m) => m.filter((id) => !Object.keys(units[0]).some((optionId) => id.endsWith(`:${optionId}`))));
    setAdded(false);
  };

  const addToCart = (): boolean => {
    if (!variant || !purchasable) return false;
    // Every candle in the pack needs every option chosen.
    const unchosen = units.flatMap((choices, unit) => options.filter((o) => !choices[o.id]).map((o) => `${unit}:${o.id}`));
    if (unchosen.length) {
      setMissing(unchosen);
      document.getElementById(`choice-${unchosen[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    const lineUnits = units.map((choices) =>
      options.map((o) => {
        const value = o.values.find((v) => v.id === choices[o.id])!;
        return { name: o.name, valueId: value.id, value: value.value };
      }),
    );
    const valueIds = lineUnits.flat().map((c) => c.valueId);
    const lineImage = images.find((i) => i.option_value_id && valueIds.includes(i.option_value_id)) ?? images[0];
    cart.add({
      key: cartKey(variant.id, lineUnits.map((u) => u.map((c) => c.valueId))),
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      units: lineUnits,
      unitPrice: variant.price,
      compareAtPrice: variant.compare_at_price,
      image: lineImage?.storage_path ?? null,
      quantity: qty,
    });
    setAdded(true);
    return true;
  };

  const stockNote = !canOrder
    ? { coming_soon: "Coming soon — not yet available to order", out_of_stock: "Out of stock", unavailable: "Currently unavailable", available: "" }[availability]
    : !variantOrderable
      ? variant?.is_coming_soon
        ? "This pack size is coming soon"
        : "This pack size is currently unavailable"
      : product.track_inventory && product.stock_quantity <= product.low_stock_threshold
        ? `Only ${product.stock_quantity} left in stock`
        : "Available to order";

  const step = (delta: number) => setImageIndex((i) => (Math.min(i, images.length - 1) + delta + images.length) % images.length);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      {/* Gallery: one large photo with small arrows instead of a thumbnail strip. */}
      <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <div
          className="relative mx-auto aspect-[4/5] w-full max-w-lg overflow-hidden rounded-xl bg-blush-light shadow-soft ring-1 ring-line"
          role={images.length > 1 ? "group" : undefined}
          aria-roledescription={images.length > 1 ? "carousel" : undefined}
          aria-label={images.length > 1 ? `${product.name} photos` : undefined}
        >
          {imageSrc ? (
            <Image key={image!.id} src={imageSrc} alt={image!.alt || product.name} fill priority sizes="(min-width: 1024px) 32rem, 100vw" className="animate-fade-up object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-copper/50">
              <ArchOrnament className="w-24" />
            </div>
          )}
          {product.on_sale && <SaleBadge className="absolute left-3 top-3" />}
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={`${arrow} left-2.5`}>
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className={`${arrow} right-2.5`}>
                <ChevronRight aria-hidden className="size-4" />
              </button>
              <p className="absolute bottom-2.5 right-2.5 rounded-full bg-ivory/90 px-2.5 py-0.5 text-xs text-cocoa" aria-live="polite">
                <span className="sr-only">Photo </span>
                {Math.min(imageIndex, images.length - 1) + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="min-w-0 rounded-xl border border-line bg-ivory p-5 shadow-soft sm:p-8">
        {children}
        <h1 className="mt-3 text-4xl sm:text-[2.75rem]">{product.name}</h1>

        {variant && (
          <div className="mt-4">
            <p className="flex flex-wrap items-baseline gap-x-3" aria-live="polite">
              <span className="text-3xl font-semibold text-copper-dark">{formatINR(variant.price)}</span>
              {variant.compare_at_price !== null && variant.compare_at_price > variant.price && (
                <s className="text-lg text-muted">
                  <span className="sr-only">Original price </span>
                  {formatINR(variant.compare_at_price)}
                </s>
              )}
              <span className="text-sm text-muted">{variant.label}</span>
            </p>
            <p className="mt-1 text-sm text-muted">Prices are inclusive of applicable GST.</p>
          </div>
        )}

        <div className="mt-6 space-y-6 border-t border-line pt-6">
          {/* 1 + 2. Colour and scent (and design), chosen for every candle in the pack. */}
          {options.length > 0 && packSize === 1 &&
            options.map((option) => {
              const id = `0:${option.id}`;
              const isMissing = missing.includes(id);
              const selected = units[0][option.id];
              return (
                <fieldset key={option.id} id={`choice-${id}`} aria-describedby={isMissing ? `choice-${id}-error` : undefined}>
                  <legend className="field-label">
                    {option.name} <span aria-hidden>*</span>
                    {selected && <span className="ml-2 font-normal text-muted">{option.values.find((v) => v.id === selected)?.value}</span>}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((v) => {
                      const disabled = v.is_coming_soon || !v.is_available;
                      return (
                        <button key={v.id} type="button" disabled={disabled} aria-pressed={selected === v.id} onClick={() => choose(0, option.id, v.id)} className={`${pill(selected === v.id, disabled)} !min-h-10`}>
                          {v.value}
                          {disabled && <span className="text-xs">({v.is_coming_soon ? "coming soon" : "unavailable"})</span>}
                        </button>
                      );
                    })}
                  </div>
                  {isMissing && (
                    <p id={`choice-${id}-error`} role="alert" className="field-error">
                      Please choose a {option.name.toLowerCase()}.
                    </p>
                  )}
                </fieldset>
              );
            })}

          {options.length > 0 && packSize > 1 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="field-label !mb-0">Choose for each candle <span aria-hidden>*</span></p>
                <button type="button" className="text-sm text-copper-dark underline underline-offset-4 hover:text-cocoa" onClick={copyFirstToAll}>
                  Use candle 1&rsquo;s choices for all
                </button>
              </div>
              <ol className="space-y-2.5">
                {units.map((choices, unit) => (
                  <li key={unit}>
                    <fieldset className="rounded-lg border border-line bg-canvas p-3">
                      <legend className="px-1.5 text-sm font-medium text-cocoa">Candle {unit + 1}</legend>
                      <div className={`grid gap-2.5 ${options.length >= 3 ? "sm:grid-cols-3" : options.length === 2 ? "sm:grid-cols-2" : ""}`}>
                        {options.map((option) => {
                          const id = `${unit}:${option.id}`;
                          const isMissing = missing.includes(id);
                          return (
                            <div key={option.id} id={`choice-${id}`}>
                              <label htmlFor={`select-${id}`} className="mb-1 block text-xs text-muted">
                                {option.name}
                              </label>
                              <select
                                id={`select-${id}`}
                                value={choices[option.id] ?? ""}
                                aria-invalid={isMissing || undefined}
                                aria-describedby={isMissing ? `choice-${id}-error` : undefined}
                                onChange={(e) => choose(unit, option.id, e.target.value)}
                                className={`input !min-h-10 !py-1.5 text-sm ${isMissing ? "!border-copper-dark" : ""}`}
                              >
                                <option value="" disabled>
                                  Choose {option.name.toLowerCase()}
                                </option>
                                {option.values.map((v) => (
                                  <option key={v.id} value={v.id} disabled={v.is_coming_soon || !v.is_available}>
                                    {v.value}
                                    {v.is_coming_soon ? " (coming soon)" : !v.is_available ? " (unavailable)" : ""}
                                  </option>
                                ))}
                              </select>
                              {isMissing && (
                                <p id={`choice-${id}-error`} role="alert" className="mt-1 text-xs font-medium text-cocoa">
                                  Choose a {option.name.toLowerCase()} for candle {unit + 1}.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 3. Pack size */}
          {product.variants.length > 0 && (
            <fieldset>
              <legend className="field-label">Pack size</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const disabled = !isVariantOrderable(v);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={disabled}
                      aria-pressed={v.id === variantId}
                      onClick={() => {
                        setVariantId(v.id);
                        setMissing([]);
                        setAdded(false);
                      }}
                      className={`${pill(v.id === variantId, disabled)} flex-col !items-start !gap-0 !rounded-xl py-1.5`}
                    >
                      <span>{v.label}</span>
                      <span className="text-xs opacity-80">{v.is_coming_soon ? "Coming soon" : !v.is_available ? "Unavailable" : formatINR(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* 4. Quantity */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <span className="field-label" id="qty-label">Quantity</span>
              <div className="inline-flex items-center rounded-full border border-line bg-ivory" role="group" aria-labelledby="qty-label">
                <button type="button" className="flex size-11 items-center justify-center rounded-full hover:text-copper-dark disabled:opacity-30" aria-label="Decrease quantity" disabled={!purchasable || qty <= 1} onClick={() => { setQuantity(qty - 1); setAdded(false); }}>
                  <Minus aria-hidden className="size-4" />
                </button>
                <output className="w-9 text-center tabular-nums" aria-live="polite">{qty}</output>
                <button type="button" className="flex size-11 items-center justify-center rounded-full hover:text-copper-dark disabled:opacity-30" aria-label="Increase quantity" disabled={!purchasable || qty >= maxQuantity} onClick={() => { setQuantity(qty + 1); setAdded(false); }}>
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
            </div>
            <p className={`flex min-h-11 items-center gap-2 text-sm ${purchasable ? "text-cocoa" : "text-muted"}`} role="status">
              <span aria-hidden className={`size-2 rounded-full ${purchasable ? "bg-copper" : "bg-blush"}`} />
              {stockNote}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-primary" disabled={!purchasable} onClick={addToCart}>
              {added ? <Check aria-hidden className="size-4" /> : <ShoppingBag aria-hidden className="size-4" />}
              {added ? "Added to cart" : purchasable ? "Add to cart" : "Not available"}
            </button>
            <button type="button" className="btn-outline" disabled={!purchasable} onClick={() => { if (added || addToCart()) router.push("/cart"); }}>
              <WhatsAppIcon className="size-[1.15rem] text-whatsapp" /> Order on WhatsApp
            </button>
          </div>
          {options.length > 0 && <p className="text-xs text-muted">* Required</p>}
          <p aria-live="polite" className="min-h-5 text-sm text-muted">
            {added && (
              <>
                Added to your cart. <Link href="/cart" className="text-copper-dark underline underline-offset-4">View cart</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
