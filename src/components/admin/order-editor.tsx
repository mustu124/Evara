"use client";

import { useRef, useState } from "react";
import { updateOrder } from "@/app/admin/actions/content";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/components/admin/bits";
import { adminBtn, adminInput, adminLabel, btnPrimary, btnSecondary, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

type Props = { id: string; status: OrderStatus; paymentStatus: PaymentStatus; adminNote: string };

export function OrderEditor({ id, status: savedStatus, paymentStatus: savedPayment, adminNote: savedNote }: Props) {
  const { run, pending, result } = useAction();
  const [status, setStatus] = useState(savedStatus);
  const [payment, setPayment] = useState(savedPayment);
  const [note, setNote] = useState(savedNote);
  const dialog = useRef<HTMLDialogElement>(null);

  const dirty = status !== savedStatus || payment !== savedPayment || note !== savedNote;
  const save = () => run(() => updateOrder({ id, status, payment_status: payment, admin_note: note }), { success: "Order updated." });
  // Cancelling and refunding are consequential, so they ask for confirmation first.
  const needsConfirm = (status === "cancelled" && savedStatus !== "cancelled") || (payment === "refunded" && savedPayment !== "refunded");

  return (
    <Panel title="Manage order" description="Opening WhatsApp does not confirm an order. Update the status here once you have agreed the details with the customer.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (needsConfirm) dialog.current?.showModal();
          else save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="o-status" className={adminLabel}>Order status</label>
            <select id="o-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={adminInput}>
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="o-payment" className={adminLabel}>Payment</label>
            <select id="o-payment" value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus)} className={adminInput}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="o-note" className={adminLabel}>Private note (not shown to the customer)</label>
          <textarea id="o-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={adminInput} />
        </div>
        <Notice result={result} />
        <button type="submit" disabled={pending || !dirty} className={btnPrimary}>
          {pending && <Spinner />} Save changes
        </button>
      </form>

      <dialog ref={dialog} onClick={(e) => e.target === dialog.current && dialog.current?.close()} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-ivory p-0 text-cocoa shadow-lift">
        <div className="p-6">
          <h2 className="font-sans text-base font-semibold text-copper-dark">
            {status === "cancelled" && savedStatus !== "cancelled" ? "Cancel this order?" : "Mark this order as refunded?"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {status === "cancelled" && savedStatus !== "cancelled"
              ? "Any stock deducted for this order will be returned to inventory. You can change the status again later."
              : "Refunded orders are no longer counted as revenue."}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => dialog.current?.close()}>Go back</button>
            <button type="button" className={`${adminBtn} bg-copper-dark text-ivory hover:bg-cocoa`} onClick={() => { dialog.current?.close(); save(); }}>
              Yes, continue
            </button>
          </div>
        </div>
      </dialog>
    </Panel>
  );
}
