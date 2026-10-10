"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/types";

export const adminInput =
  "block min-h-10 w-full rounded-lg border border-line bg-ivory px-3 py-1.5 text-sm text-cocoa placeholder:text-muted/60 hover:border-blush focus:border-copper focus:outline-none focus:ring-2 focus:ring-copper/20 disabled:bg-blush/30 disabled:text-muted [&[readonly]]:bg-blush/30 [&[readonly]]:text-muted";
export const adminLabel = "mb-1 block text-xs font-medium text-muted";
export const adminBtn =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50";
export const btnPrimary = `${adminBtn} bg-copper text-ivory hover:bg-copper-dark`;
export const btnSecondary = `${adminBtn} border border-line bg-ivory text-cocoa hover:border-blush hover:bg-blush/30`;
export const btnDanger = `${adminBtn} border border-blush bg-ivory text-copper-dark hover:bg-blush/40`;

export function Panel({ title, description, children, actions }: { title?: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-ivory p-5 shadow-soft sm:p-6">
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-sans text-base font-semibold text-copper-dark">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? "border border-line bg-blush-light/60 text-cocoa" : "border border-blush bg-blush/40 font-medium text-cocoa"}`}>
      {result.ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> : <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}
      {result.message}
    </p>
  );
}

export function Spinner() {
  return <Loader2 aria-hidden className="size-4 animate-spin" />;
}

export function Checkbox({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-2 text-sm text-cocoa">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-copper" {...props} />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Runs a server action with a pending state and a result message, then
 * refreshes the current route so server-rendered data is up to date.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const run = <T extends object>(
    action: () => Promise<ActionResult<T>>,
    options: { success?: string; onSuccess?: (data: { ok: true } & T) => void } = {},
  ) => {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.ok) {
          setResult(options.success ? { ok: true, message: options.success } : null);
          options.onSuccess?.(res);
          router.refresh();
        } else {
          setResult({ ok: false, message: res.error });
        }
      } catch {
        setResult({ ok: false, message: "Could not reach the server. Please try again." });
      }
    });
  };

  return { run, pending, result, clear: () => setResult(null) };
}

type ConfirmProps = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** A button that asks for confirmation in a modal dialog before acting. */
export function ConfirmButton({ title, body, confirmLabel, onConfirm, danger = true, disabled, className, children }: ConfirmProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <>
      <button type="button" disabled={disabled} className={className ?? (danger ? btnDanger : btnSecondary)} onClick={() => setOpen(true)}>
        {children}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-ivory p-0 text-cocoa shadow-lift"
      >
        <div className="p-6">
          <h2 className="font-sans text-base font-semibold text-copper-dark">{title}</h2>
          <p className="mt-2 text-sm text-muted">{body}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Cancel</button>
            <button
              type="button"
              className={danger ? `${adminBtn} bg-copper-dark text-ivory hover:bg-cocoa` : btnPrimary}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
