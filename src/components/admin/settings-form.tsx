"use client";

import { useState } from "react";
import { saveStoreSettings } from "@/app/admin/actions/content";
import { adminInput, adminLabel, btnPrimary, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import type { StoreSettings } from "@/lib/types";
import { INDIAN_STATES } from "@/lib/validation";

type Rates = "shipping_rate_intra_per_kg" | "shipping_rate_inter_per_kg";
type Draft = Omit<StoreSettings, Rates | "free_shipping_above" | "default_gst_rate"> & Record<Rates, string> & { free_shipping_above: string; default_gst_rate: string };

export function SettingsForm({ initial, envFallback }: { initial: StoreSettings; envFallback: boolean }) {
  const [draft, setDraft] = useState<Draft>({
    ...initial,
    shipping_rate_intra_per_kg: String(initial.shipping_rate_intra_per_kg ?? 0),
    shipping_rate_inter_per_kg: String(initial.shipping_rate_inter_per_kg ?? 0),
    free_shipping_above: initial.free_shipping_above === null ? "" : String(initial.free_shipping_above),
    default_gst_rate: String(initial.default_gst_rate ?? 5),
  });
  const { run, pending, result } = useAction();
  const bind = (key: keyof Draft) => ({
    id: `s-${key}`,
    value: draft[key],
    className: adminInput,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [key]: e.target.value })),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveStoreSettings({ ...draft, shipping_rate_intra_per_kg: draft.shipping_rate_intra_per_kg || 0, shipping_rate_inter_per_kg: draft.shipping_rate_inter_per_kg || 0 }), { success: "Settings saved. The store has been updated." });
      }}
    >
      <Panel title="WhatsApp ordering" description="Orders are sent to this number. Customers cannot check out until it is set.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-whatsapp_number" className={adminLabel}>WhatsApp business number</label>
            <input type="tel" inputMode="tel" placeholder="Country code + number, e.g. 919876543210" aria-describedby="s-wa-hint" {...bind("whatsapp_number")} />
            <p id="s-wa-hint" className="mt-1 text-xs text-muted">
              Digits only, starting with the country code (91 for India). No + or spaces needed.
              {!draft.whatsapp_number && envFallback && " A fallback number from the server configuration is currently in use."}
            </p>
          </div>
          <div>
            <label htmlFor="s-phone_display" className={adminLabel}>Number as shown to customers</label>
            <input placeholder="e.g. +91 98765 43210" maxLength={40} {...bind("phone_display")} />
          </div>
        </div>
      </Panel>

      <Panel title="Contact details" description="Shown in the footer and on the Contact page. Leave a field empty to hide it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-email" className={adminLabel}>Public email address</label>
            <input type="email" {...bind("email")} />
          </div>
          <div>
            <label htmlFor="s-instagram_url" className={adminLabel}>Instagram link</label>
            <input type="url" placeholder="https://www.instagram.com/yourhandle" {...bind("instagram_url")} />
          </div>
          <div>
            <label htmlFor="s-business_hours" className={adminLabel}>Business hours</label>
            <input maxLength={120} placeholder="e.g. Mon to Sat, 10 am to 7 pm" {...bind("business_hours")} />
          </div>
          <div>
            <label htmlFor="s-address" className={adminLabel}>Address or city</label>
            <input maxLength={300} {...bind("address")} />
          </div>
        </div>
      </Panel>

      <Panel title="GST" description="Prices on the store already include GST. These settings decide how the tax inside each order is worked out and shown. Confirm the correct rate with your accountant before going live.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-seller_state" className={adminLabel}>State the business is registered in</label>
            <select id="s-seller_state" value={draft.seller_state} className={adminInput} onChange={(e) => setDraft((d) => ({ ...d, seller_state: e.target.value }))}>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Deliveries within this state show CGST + SGST; other states show IGST.</p>
          </div>
          <div>
            <label htmlFor="s-default_gst_rate" className={adminLabel}>Default GST rate (%)</label>
            <input type="number" min={0} max={40} step="0.01" required {...bind("default_gst_rate")} />
            <p className="mt-1 text-xs text-muted">Used for every product that does not set its own rate, and for shipping.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Shipping" description="Charged per kg of the order's total weight, rounded up to the next whole kg (e.g. 1.2 kg is charged as 2 kg). GST-inclusive. Each product's weight is set on the product.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-shipping_rate_intra_per_kg" className={adminLabel}>Within {draft.seller_state} (₹ per kg)</label>
            <input type="number" min={0} step="0.01" {...bind("shipping_rate_intra_per_kg")} />
          </div>
          <div>
            <label htmlFor="s-shipping_rate_inter_per_kg" className={adminLabel}>All other states (₹ per kg)</label>
            <input type="number" min={0} step="0.01" {...bind("shipping_rate_inter_per_kg")} />
          </div>
          <div>
            <label htmlFor="s-free_shipping_above" className={adminLabel}>Free shipping for orders of at least (₹)</label>
            <input type="number" min={0} step="0.01" placeholder="Optional" {...bind("free_shipping_above")} />
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Spinner />} Save settings</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
