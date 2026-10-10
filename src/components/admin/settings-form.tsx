"use client";

import { useState } from "react";
import { saveStoreSettings } from "@/app/admin/actions/content";
import { adminInput, adminLabel, btnPrimary, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import type { StoreSettings } from "@/lib/types";

type Draft = Omit<StoreSettings, "shipping_fee" | "free_shipping_above"> & { shipping_fee: string; free_shipping_above: string };

export function SettingsForm({ initial, envFallback }: { initial: StoreSettings; envFallback: boolean }) {
  const [draft, setDraft] = useState<Draft>({
    ...initial,
    shipping_fee: String(initial.shipping_fee ?? 0),
    free_shipping_above: initial.free_shipping_above === null ? "" : String(initial.free_shipping_above),
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
        run(() => saveStoreSettings({ ...draft, shipping_fee: draft.shipping_fee === "" ? 0 : draft.shipping_fee }), { success: "Settings saved. The store has been updated." });
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

      <Panel title="Shipping" description="Leave the fee at 0 to confirm shipping with each customer on WhatsApp instead.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-shipping_fee" className={adminLabel}>Flat shipping fee (₹)</label>
            <input type="number" min={0} step="0.01" {...bind("shipping_fee")} />
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
