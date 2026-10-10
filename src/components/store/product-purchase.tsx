"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { ArchOrnament, WhatsAppIcon } from "@/components/icons";
import { cart, cartKey, MAX_LINE_QUANTITY } from "@/lib/cart";
import { formatINR, imageUrl, isVariantOrderable, productAvailability } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";

const pill = (selected: boolean, disabled: boolean) =>
  `choice ${disabled ? "choice-disabled" : selected ? "choice-selected" : ""}`;

export function ProductPurchase({ product, children }: { product: ProductDetail; children?: React.ReactNode }) {
  const router = useRouter();
  const availability = productAvailability(product);
  const canOrder = availability === "available";

  const [variantId, setVariantId] = useState(
    () => (product.variants.find(isVariantOrderable) ?? product.variants[0])?.id ?? "",
  );
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [imageId, setImageId] = useState(product.images[0]?.id ?? "");
  const [missing, setMissing] = useState<string[]>([]);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId);
  const image = product.images.find((i) => i.id === imageId) ?? product.images[0];
  const imageSrc = imageUrl(image?.storage_path);

  const maxQuantity = useMemo(() => {
    if (!variant || !product.track_inventory) return MAX_LINE_QUANTITY;
    return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(product.stock_quantity / variant.pack_quantity)));
  }, [variant, product.track_inventory, product.stock_quantity]);

  const variantOrderable = Boolean(variant && isVariantOrderable(variant) && maxQuantity > 0);
  const purchasable = canOrder && variantOrderable;
  const qty = Math.min(quantity, Math.max(1, maxQuantity));

  const choose = (optionId: string, valueId: string) => {
    setSelected((s) => ({ ...s, [optionId]: valueId }));
    setMissing((m) => m.filter((id) => id !== optionId));
    setAdded(false);
    const linked = product.images.find((i) => i.option_value_id === valueId);
    if (linked) setImageId(linked.id);
  };

  const addToCart = (): boolean => {
    if (!variant || !purchasable) return false;
    const unchosen = product.options.filter((o) => !selected[o.id]).map((o) => o.id);
    if (unchosen.length) {
      setMissing(unchosen);
      document.getElementById(`option-${unchosen[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    const options = product.options.map((o) => {
      const value = o.values.find((v) => v.id === selected[o.id])!;
      return { name: o.name, valueId: value.id, value: value.value };
    });
    const valueIds = options.map((o) => o.valueId);
    const lineImage = product.images.find((i) => i.option_value_id && valueIds.includes(i.option_value_id)) ?? product.images[0];
    cart.add({
      key: cartKey(variant.id, valueIds),
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      options,
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

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
      {/* Gallery */}
      <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-lg overflow-hidden rounded-xl bg-blush shadow-soft ring-1 ring-line">
          {imageSrc ? (
            <Image key={image!.id} src={imageSrc} alt={image!.alt || product.name} fill priority sizes="(min-width: 1024px) 32rem, 100vw" className="animate-fade-up object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-copper/50">
              <ArchOrnament className="w-24" />
            </div>
          )}
        </div>
        {product.images.length > 1 && (
          <ul className="mx-auto mt-4 flex max-w-lg gap-2.5 overflow-x-auto pb-2" aria-label="Product images">
            {product.images.map((img, i) => {
              const src = imageUrl(img.storage_path);
              if (!src) return null;
              const current = img.id === image?.id;
              return (
                <li key={img.id} className="shrink-0 p-0.5">
                  <button type="button" onClick={() => setImageId(img.id)} aria-label={`Show image ${i + 1}${img.alt ? `: ${img.alt}` : ""}`} aria-current={current} className={`relative block h-20 w-16 overflow-hidden rounded-lg ring-1 transition-shadow ${current ? "ring-2 ring-copper" : "ring-line hover:ring-blush"}`}>
                    <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 rounded-xl border border-line bg-ivory p-6 shadow-soft sm:p-9">
        {children}
        <h1 className="mt-4 text-4xl sm:text-5xl">{product.name}</h1>

        {variant && (
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3" aria-live="polite">
            <span className="text-3xl font-semibold text-copper">{formatINR(variant.price)}</span>
            {variant.compare_at_price !== null && variant.compare_at_price > variant.price && (
              <s className="text-lg text-muted">
                <span className="sr-only">Original price </span>
                {formatINR(variant.compare_at_price)}
              </s>
            )}
            <span className="text-sm text-muted">{variant.label}</span>
          </p>
        )}

        {product.description && <p className="mt-6 leading-relaxed text-cocoa/90">{product.description}</p>}

        <div className="mt-8 space-y-7 border-t border-line pt-8">
          {product.variants.length > 0 && (
            <fieldset>
              <legend className="field-label">Pack size</legend>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((v) => {
                  const disabled = !isVariantOrderable(v);
                  return (
                    <button key={v.id} type="button" disabled={disabled} aria-pressed={v.id === variantId} onClick={() => { setVariantId(v.id); setAdded(false); }} className={`${pill(v.id === variantId, disabled)} flex-col !items-start !gap-0 !rounded-xl py-2`}>
                      <span>{v.label}</span>
                      <span className="text-xs opacity-80">{v.is_coming_soon ? "Coming soon" : !v.is_available ? "Unavailable" : formatINR(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {product.options.map((option) => {
            const isMissing = missing.includes(option.id);
            return (
              <fieldset key={option.id} id={`option-${option.id}`} aria-describedby={isMissing ? `option-${option.id}-error` : undefined}>
                <legend className="field-label">
                  Choose your preferred {option.name.toLowerCase()}
                  {selected[option.id] && (
                    <span className="ml-2 normal-case tracking-normal text-cocoa">
                      — {option.values.find((v) => v.id === selected[option.id])?.value}
                    </span>
                  )}
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {option.values.map((v) => {
                    const disabled = v.is_coming_soon || !v.is_available;
                    return (
                      <button key={v.id} type="button" disabled={disabled} aria-pressed={selected[option.id] === v.id} onClick={() => choose(option.id, v.id)} className={pill(selected[option.id] === v.id, disabled)}>
                        {v.value}
                        {disabled && <span className="ml-2 text-[0.62rem] uppercase tracking-[0.14em]">{v.is_coming_soon ? "Coming soon" : "Unavailable"}</span>}
                      </button>
                    );
                  })}
                </div>
                {isMissing && (
                  <p id={`option-${option.id}-error`} role="alert" className="field-error">
                    Please choose a {option.name.toLowerCase()}.
                  </p>
                )}
              </fieldset>
            );
          })}

          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <span className="field-label" id="qty-label">Quantity</span>
              <div className="inline-flex items-center rounded-full border border-line bg-ivory" role="group" aria-labelledby="qty-label">
                <button type="button" className="flex size-11 items-center justify-center rounded-full hover:text-copper disabled:opacity-30" aria-label="Decrease quantity" disabled={!purchasable || qty <= 1} onClick={() => { setQuantity(qty - 1); setAdded(false); }}>
                  <Minus aria-hidden className="size-4" />
                </button>
                <output className="w-9 text-center tabular-nums" aria-live="polite">{qty}</output>
                <button type="button" className="flex size-11 items-center justify-center rounded-full hover:text-copper disabled:opacity-30" aria-label="Increase quantity" disabled={!purchasable || qty >= maxQuantity} onClick={() => { setQuantity(qty + 1); setAdded(false); }}>
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
          <p aria-live="polite" className="min-h-6 text-sm text-muted">
            {added && (
              <>
                Added to your cart. <Link href="/cart" className="text-copper underline underline-offset-4">View cart</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
