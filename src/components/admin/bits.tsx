import type { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";

export function AdminHeading({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-sans text-2xl font-semibold text-copper-dark">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const TONES = {
  neutral: "bg-blush/40 text-cocoa",
  amber: "bg-blush/60 text-cocoa",
  blue: "bg-copper/15 text-copper-dark",
  green: "bg-copper/15 text-copper-dark",
  red: "border border-blush bg-ivory text-muted",
  rose: "bg-blush/70 text-cocoa",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const ORDER_STATUSES: { value: OrderStatus; label: string; tone: keyof typeof TONES }[] = [
  { value: "pending", label: "Pending", tone: "amber" },
  { value: "confirmed", label: "Confirmed", tone: "blue" },
  { value: "processing", label: "Processing", tone: "blue" },
  { value: "shipped", label: "Shipped", tone: "blue" },
  { value: "completed", label: "Completed", tone: "green" },
  { value: "cancelled", label: "Cancelled", tone: "red" },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string; tone: keyof typeof TONES }[] = [
  { value: "unpaid", label: "Unpaid", tone: "amber" },
  { value: "paid", label: "Paid", tone: "green" },
  { value: "refunded", label: "Refunded", tone: "neutral" },
];

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUSES.find((o) => o.value === status);
  return <Badge tone={s?.tone}>{s?.label ?? status}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUSES.find((o) => o.value === status);
  return <Badge tone={s?.tone}>{s?.label ?? status}</Badge>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const map = { published: ["green", "Published"], draft: ["amber", "Draft"], archived: ["neutral", "Archived"] } as const;
  return <Badge tone={map[status][0]}>{map[status][1]}</Badge>;
}

export function AdminEmpty({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-blush bg-ivory px-6 py-12 text-center">
      <p className="font-medium text-cocoa">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-blush bg-blush/40 px-4 py-3 text-sm font-medium text-cocoa">
      Could not load this data: {message}. Check that the database migrations have been applied.
    </p>
  );
}
