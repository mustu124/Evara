"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, Check, Copy, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { placeOrder, reviewCart, type CartReview, type PlaceOrderResult } from "@/app/actions/order";
import { ArchOrnament, WhatsAppIcon } from "@/components/icons";
import { EmptyState } from "@/components/store/bits";
import { cart, MAX_LINE_QUANTITY, useCart, type CartLine } from "@/lib/cart";
import { formatINR, formatINRExact, imageUrl } from "@/lib/format";
import { buildInvoice, formatRate, isIntraState, type Invoice } from "@/lib/gst";
import { shippingCharge } from "@/lib/shipping";
import { customerSchema, INDIAN_STATES, type CustomerInput } from "@/lib/validation";

type Confirmation = Extract<PlaceOrderResult, { ok: true }>;
const LAST_ORDER_KEY = "evara-last-order";

const noop = () => () => {};
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

const toItems = (lines: CartLine[]) =>
  lines.map((l) => ({
    key: l.key,
    variant_id: l.variantId,
    units: l.units.map((unit) => unit.map((c) => c.valueId)),
    quantity: l.quantity,
  }));

/** Marks a mandatory field. */
function Req() {
  return (
    <>
      <span aria-hidden className="text-copper-dark">*</span>
      <span className="sr-only">(required)</span>
    </>
  );
}

/** Taxable value, the GST contained in it (CGST + SGST or IGST, shown as one amount) and the total. */
function TaxBreakdown({ invoice, className = "" }: { invoice: Pick<Invoice, "taxable" | "cgst" | "sgst" | "igst" | "rate" | "total">; className?: string }) {
  const row = "flex justify-between gap-3";
  return (
    <div className={`rounded-lg border border-line bg-canvas p-3.5 ${className}`}>
      <p className="text-xs font-medium text-cocoa">Price Breakdown</p>
      <dl className="mt-2 space-y-1 text-xs text-muted">
        <div className={row}><dt>Taxable value</dt><dd className="tabular-nums text-cocoa">{formatINRExact(invoice.taxable)}</dd></div>
        <div className={row}><dt>GST{invoice.rate === null ? "" : ` @ ${formatRate(invoice.rate)}%`}</dt><dd className="tabular-nums text-cocoa">{formatINRExact(invoice.cgst + invoice.sgst + invoice.igst)}</dd></div>
        <div className={`${row} border-t border-line pt-1 font-medium text-cocoa`}><dt>Total invoice value</dt><dd className="tabular-nums">{formatINRExact(invoice.total)}</dd></div>
      </dl>
    </div>
  );
}

export function CartView() {
  const hydrated = useHydrated();
  const lines = useCart();
  const [reviewState, setReviewState] = useState<{ signature: string; review: CartReview } | null>(null);
  const [step, setStep] = useState<"cart" | "details">("cart");
  const [placed, setPlaced] = useState<Confirmation | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", email: "", gstin: "", address_line1: "", address_line2: "", city: "", pincode: "", note: "" },
  });
  const deliveryState = useWatch({ control, name: "state" }) ?? "";

  // A just-created order survives a refresh so its reference is not lost.
  const restored = useMemo<Confirmation | null>(() => {
    if (!hydrated) return null;
    try {
      const saved = window.sessionStorage.getItem(LAST_ORDER_KEY);
      return saved ? (JSON.parse(saved) as Confirmation) : null;
    } catch {
      return null;
    }
  }, [hydrated]);
  const confirmation = dismissed ? null : (placed ?? restored);

  // Re-price the cart from the database whenever its contents change.
  const signature = useMemo(() => JSON.stringify(toItems(lines)), [lines]);
  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await reviewCart(JSON.parse(signature));
        if (cancelled) return;
        setReviewState({ signature, review: result });
        const updates = new Map<string, Partial<CartLine>>();
        for (const l of result.lines) {
          if (l.name === undefined || l.unitPrice === undefined) continue;
          updates.set(l.key, {
            name: l.name,
            slug: l.slug,
            variantLabel: l.variantLabel,
            unitPrice: l.unitPrice,
            compareAtPrice: l.compareAtPrice ?? null,
            image: l.image ?? null,
          });
        }
        cart.patch(updates);
      } catch {
        if (!cancelled) {
          setReviewState({
            signature,
            review: { ok: false, error: "We could not check your cart just now.", lines: [], subtotal: 0, weightGrams: 0, shippingRates: { intra: 0, inter: 0 }, freeShippingAbove: null, shippingGstRate: 0, sellerState: "", whatsappConfigured: false },
          });
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures the relevant cart contents
  }, [signature, hydrated]);

  const review = lines.length > 0 ? (reviewState?.review ?? null) : null;
  const reviewing = lines.length > 0 && reviewState?.signature !== signature;
  const reviewed = useMemo(() => new Map((review?.lines ?? []).map((l) => [l.key, l])), [review]);
  const localSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const subtotal = review?.ok ? review.subtotal : localSubtotal;
  // Shipping is charged per kg (rounded up) at the rate for the delivery state, so it is known once a state is chosen.
  const shippingKnown = Boolean(review?.ok && deliveryState);
  const shipping =
    review?.ok && deliveryState
      ? shippingCharge({
          grams: review.weightGrams,
          ratePerKg: isIntraState(deliveryState, review.sellerState) ? review.shippingRates.intra : review.shippingRates.inter,
          subtotal,
          freeShippingAbove: review.freeShippingAbove,
        })
      : 0;
  const total = subtotal + shipping;
  // GST is already inside these prices. The split (CGST + SGST, or IGST) depends on the delivery state.
  const invoice = useMemo<Invoice | null>(() => {
    if (!review?.ok) return null;
    const amounts = lines.flatMap((l) => {
      const r = reviewed.get(l.key);
      return r?.ok && r.unitPrice !== undefined ? [{ amount: r.unitPrice * l.quantity, rate: r.gstRate ?? 0 }] : [];
    });
    if (shipping > 0) amounts.push({ amount: shipping, rate: review.shippingGstRate });
    // Until a state is chosen the split is unknown; the total tax is the same either way to within a paisa.
    return buildInvoice(amounts, deliveryState || "-", review.sellerState);
  }, [review, reviewed, lines, deliveryState, shipping]);
  const hasProblems = lines.some((l) => reviewed.get(l.key)?.ok === false || lineErrors[l.key]);
  const canCheckout = lines.length > 0 && !reviewing && review?.ok === true && !hasProblems && review.whatsappConfigured;

  const openWhatsApp = (url: string) => {
    // Opened after an async call, so browsers may block it; the confirmation
    // screen always offers a real link as the fallback.
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    setPopupBlocked(!win);
  };

  const onSubmit = handleSubmit(async (customer, event) => {
    const honeypot = (event?.target as HTMLFormElement | undefined)?.elements.namedItem("website");
    setFormError(null);
    setLineErrors({});
    const submitted = [...lines];
    let result: PlaceOrderResult;
    try {
      result = await placeOrder({
        customer,
        items: toItems(submitted).map(({ variant_id, units, quantity }) => ({ variant_id, units, quantity })),
        website: honeypot instanceof HTMLInputElement ? honeypot.value : "",
      });
    } catch {
      setFormError("We could not reach the store. Please check your connection and try again.");
      return;
    }
    if (!result.ok) {
      if (result.itemErrors?.length) {
        setLineErrors(Object.fromEntries(result.itemErrors.flatMap((e) => (submitted[e.index] ? [[submitted[e.index].key, e.message]] : []))));
        setStep("cart");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setFormError(result.error);
      return;
    }
    try {
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(result));
    } catch {
      /* ignore */
    }
    setPlaced(result);
    setDismissed(false);
    cart.clear();
    window.scrollTo({ top: 0 });
    openWhatsApp(result.whatsappUrl);
  });

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24 text-muted" role="status">
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading your cart</span>
      </div>
    );
  }

  /* ───────── Order created: the customer still has to send the message ───────── */
  if (confirmation) {
    return (
      <div className="mx-auto max-w-xl py-6 text-center">
        <ArchOrnament className="mx-auto w-20 text-copper-dark" />
        <p className="eyebrow mt-6">One last step</p>
        <h2 className="mt-3 text-4xl">Send your order on WhatsApp</h2>
        <p className="mt-4 text-muted">
          Your order request has been saved, but it reaches us only when you send the prepared WhatsApp message.
        </p>

        <div className="card mt-8 p-6">
          <p className="field-label !mb-1">Order reference</p>
          <p className="font-serif text-3xl tracking-wide text-cocoa">{confirmation.reference}</p>
          <p className="mt-1 text-sm text-muted">Total {formatINR(confirmation.total)}</p>
        </div>

        {confirmation.invoice && confirmation.invoice.taxable > 0 && (
          <div className="card mt-4 p-5 text-left">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatINR(confirmation.invoice.subtotal)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{confirmation.invoice.shipping > 0 ? formatINR(confirmation.invoice.shipping) : "Free"}</dd>
              </div>
            </dl>
            <TaxBreakdown className="mt-3" invoice={confirmation.invoice} />
          </div>
        )}

        {popupBlocked && (
          <p role="alert" className="mt-6 rounded-xl border border-blush bg-ivory px-4 py-3 text-sm text-cocoa">
            WhatsApp did not open automatically. Use the button below, or copy the message and send it to us yourself.
          </p>
        )}

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <a href={confirmation.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <WhatsAppIcon className="size-4" /> Open WhatsApp
          </a>
          <button
            type="button"
            className="btn-quiet"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(confirmation.message);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>

        <ol className="mx-auto mt-10 max-w-md space-y-3 text-left text-sm text-cocoa/90">
          <li className="flex gap-3"><span className="font-serif text-xl text-copper-dark">1.</span> Tap &ldquo;Open WhatsApp&rdquo; and click &ldquo;Send&rdquo; button for the pre-filled order message.</li>
          <li className="flex gap-3"><span className="font-serif text-xl text-copper-dark">2.</span> We&rsquo;ll reply to confirm product availability, delivery details and payment instructions with you.</li>
          <li className="flex gap-3"><span className="font-serif text-xl text-copper-dark">3.</span> Your order will be confirmed once we&rsquo;ve replied to confirm it. No payment is collected on this website; payment is to be made via UPI using the QR code we share with you on WhatsApp.</li>
        </ol>

        <details className="mx-auto mt-8 max-w-md text-left">
          <summary className="text-sm text-copper-dark underline underline-offset-4">View the message</summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-line bg-ivory p-4 font-sans text-sm text-cocoa">{confirmation.message}</pre>
        </details>

        <button
          type="button"
          className="mt-10 text-sm text-muted underline underline-offset-4 hover:text-copper-dark"
          onClick={() => {
            try {
              window.sessionStorage.removeItem(LAST_ORDER_KEY);
            } catch {
              /* ignore */
            }
            setPlaced(null);
            setDismissed(true);
            setStep("cart");
          }}
        >
          I have sent my order — continue shopping
        </button>
      </div>
    );
  }

  if (lines.length === 0) {
    return <EmptyState title="Your cart is empty" body="Discover an item you love and it will be shown here." action={{ href: "/shop", label: "Continue shopping" }} />;
  }

  const field = (name: keyof CustomerInput) => ({
    id: `checkout-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `checkout-${name}-error` : undefined,
    ...register(name),
  });
  const fieldError = (name: keyof CustomerInput) =>
    errors[name] && (
      <p id={`checkout-${name}-error`} role="alert" className="field-error">
        {errors[name]?.message}
      </p>
    );

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <div>
        {review && !review.ok && (
          <p role="alert" className="mb-6 rounded-xl border border-blush bg-ivory px-4 py-3 text-sm text-cocoa">{review.error}</p>
        )}

        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => {
            const src = imageUrl(line.image);
            const problem = lineErrors[line.key] ?? (reviewed.get(line.key)?.ok === false ? reviewed.get(line.key)?.message : undefined);
            return (
              <li key={line.key} className="flex gap-4 py-6 sm:gap-6">
                <Link href={`/shop/${line.slug}`} className="relative block h-28 w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-blush ring-1 ring-line sm:h-32 sm:w-24" aria-label={`View ${line.name}`}>
                  {src && <Image src={src} alt="" fill sizes="96px" className="object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl leading-snug sm:text-2xl">
                      <Link href={`/shop/${line.slug}`} className="hover:text-copper-dark">{line.name}</Link>
                    </h2>
                    <p className="shrink-0 font-semibold text-copper-dark">{formatINR(line.unitPrice * line.quantity)}</p>
                  </div>
                  <dl className="mt-1 space-y-0.5 text-sm text-muted">
                    <div className="flex gap-1.5"><dt>Pack size:</dt><dd className="text-cocoa">{line.variantLabel}</dd></div>
                    {line.units.length <= 1
                      ? (line.units[0] ?? []).map((o) => (
                          <div key={o.valueId} className="flex gap-1.5"><dt>{o.name}:</dt><dd className="text-cocoa">{o.value}</dd></div>
                        ))
                      : line.units.map((unit, n) => (
                          <div key={n} className="flex gap-1.5">
                            <dt className="shrink-0">Candle {n + 1}:</dt>
                            <dd className="text-cocoa">{unit.map((o) => `${o.name} ${o.value}`).join(", ")}</dd>
                          </div>
                        ))}
                    <div className="flex gap-1.5"><dt>Price:</dt><dd>{formatINR(line.unitPrice)} each</dd></div>
                  </dl>
                  {problem && <p role="alert" className="field-error">{problem}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full border border-line bg-ivory" role="group" aria-label={`Quantity for ${line.name}`}>
                      <button type="button" className="flex size-10 items-center justify-center rounded-full hover:text-copper-dark disabled:opacity-30" aria-label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => { setLineErrors({}); cart.setQuantity(line.key, line.quantity - 1); }}>
                        <Minus aria-hidden className="size-3.5" />
                      </button>
                      <output className="w-8 text-center text-sm tabular-nums" aria-live="polite">{line.quantity}</output>
                      <button type="button" className="flex size-10 items-center justify-center rounded-full hover:text-copper-dark disabled:opacity-30" aria-label="Increase quantity" disabled={line.quantity >= MAX_LINE_QUANTITY} onClick={() => { setLineErrors({}); cart.setQuantity(line.key, line.quantity + 1); }}>
                        <Plus aria-hidden className="size-3.5" />
                      </button>
                    </div>
                    <button type="button" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm text-muted hover:text-copper-dark" onClick={() => { setLineErrors({}); cart.remove(line.key); }}>
                      <Trash2 aria-hidden className="size-4" /> Remove<span className="sr-only"> {line.name}</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link href="/shop" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-copper-dark hover:text-copper-dark">
          <ArrowLeft aria-hidden className="size-4" /> Continue shopping
        </Link>

        {step === "details" && (
          <div ref={detailsRef} className="mt-10 scroll-mt-28 border-t border-line pt-10">
            <h2 className="text-3xl">Delivery details</h2>
            <p className="mt-2 text-sm text-muted">We use these only to prepare and deliver your order. Fields marked <Req /> are mandatory.</p>
            <form id="checkout-form" onSubmit={onSubmit} noValidate className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="checkout-name" className="field-label">Full name <Req /></label>
                <input type="text" autoComplete="name" className="input" required aria-required="true" {...field("name")} />
                {fieldError("name")}
              </div>
              <div>
                <label htmlFor="checkout-phone" className="field-label">Mobile number <Req /></label>
                <input type="tel" inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" className="input" required aria-required="true" {...field("phone")} />
                {fieldError("phone")}
              </div>
              <div>
                <label htmlFor="checkout-email" className="field-label">Email</label>
                <input type="email" autoComplete="email" className="input" {...field("email")} />
                {fieldError("email")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-address_line1" className="field-label">Address line 1 <Req /></label>
                <input type="text" autoComplete="address-line1" placeholder="Flat / house no., street, area" className="input" required aria-required="true" {...field("address_line1")} />
                {fieldError("address_line1")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-address_line2" className="field-label">Address line 2</label>
                <input type="text" autoComplete="address-line2" placeholder="Landmark, colony" className="input" {...field("address_line2")} />
                {fieldError("address_line2")}
              </div>
              <div>
                <label htmlFor="checkout-city" className="field-label">City <Req /></label>
                <input type="text" autoComplete="address-level2" className="input" required aria-required="true" {...field("city")} />
                {fieldError("city")}
              </div>
              <div>
                <label htmlFor="checkout-pincode" className="field-label">Pincode <Req /></label>
                <input type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} className="input" required aria-required="true" {...field("pincode")} />
                {fieldError("pincode")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-state" className="field-label">State / UT <Req /></label>
                <select autoComplete="address-level1" defaultValue="" className="input" required aria-required="true" {...field("state")}>
                  <option value="" disabled>Select state / UT</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {fieldError("state")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-gstin" className="field-label">GSTIN</label>
                <input type="text" autoComplete="off" autoCapitalize="characters" maxLength={15} placeholder="Only if you have one, e.g. 27ABCDE1234F1Z5" className="input uppercase placeholder:normal-case" {...field("gstin")} />
                {fieldError("gstin")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-note" className="field-label">Order note</label>
                <textarea rows={3} maxLength={500} className="input" {...field("note")} />
                {fieldError("note")}
              </div>
              {/* Honeypot for bots: hidden from people and assistive technology. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-labelledby="summary-heading">
        <div className="card p-6 sm:p-7">
          <h2 id="summary-heading" className="text-2xl">Order Summary</h2>
          <dl className="mt-5 space-y-2.5 text-sm" aria-busy={reviewing}>
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatINR(subtotal)}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-right">
                {!review?.ok || subtotal === 0 ? "—" : !shippingKnown ? "Added at checkout" : shipping > 0 ? formatINR(shipping) : "Free"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-4 text-base">
              <dt className="font-medium text-cocoa">{shippingKnown || !review?.ok ? "Total" : "Total before shipping"}</dt>
              <dd className="text-2xl font-semibold text-copper-dark">{formatINR(total)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-xs text-muted">Prices are inclusive of applicable GST.</p>

          {invoice && invoice.total > 0 && <TaxBreakdown invoice={invoice} className="mt-5" />}

          {formError && <p role="alert" className="mt-5 rounded-xl border border-blush bg-ivory px-4 py-3 text-sm text-cocoa">{formError}</p>}
          {review?.ok && !review.whatsappConfigured && (
            <p role="status" className="mt-5 rounded-xl border border-blush bg-ivory px-4 py-3 text-sm text-cocoa">
              WhatsApp ordering is not available yet. Please <Link href="/contact" className="underline underline-offset-4">contact us</Link> to place your order.
            </p>
          )}
          {hasProblems && <p className="mt-5 text-sm font-medium text-cocoa">Please update the highlighted items before continuing.</p>}

          {step === "cart" ? (
            <button
              key="proceed"
              type="button"
              className="btn-primary mt-6 w-full"
              disabled={!canCheckout}
              onClick={() => {
                setStep("details");
                window.setTimeout(() => {
                  detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  document.getElementById("checkout-name")?.focus({ preventScroll: true });
                }, 60);
              }}
            >
              {reviewing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <WhatsAppIcon className="size-4" />}
              Proceed to WhatsApp
            </button>
          ) : (
            <button key="send" type="submit" form="checkout-form" className="btn-primary mt-6 w-full" disabled={!canCheckout || isSubmitting}>
              {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <WhatsAppIcon className="size-4" />}
              {isSubmitting ? "Preparing order…" : `Send order · ${formatINR(total)}`}
            </button>
          )}
          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            Payment via UPI - Pay after confirming your order on WhatsApp. We&rsquo;ll share a UPI QR code for payment. No
            payment is taken on this website.
          </p>
        </div>
      </aside>
    </div>
  );
}
