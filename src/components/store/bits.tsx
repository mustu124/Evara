import Link from "next/link";
import { ArchOrnament } from "@/components/icons";
import { getBackendStatus } from "@/lib/data/settings";

export function SectionHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-xl text-center">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-4xl sm:text-[2.75rem]">{title}</h2>
      <span aria-hidden className="mx-auto mt-4 block h-px w-12 bg-copper" />
      {intro && <p className="mt-5 text-muted">{intro}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-blush-light">
      <div className="container-x py-8 text-center sm:py-10">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 text-4xl sm:text-5xl">{title}</h1>
        {intro && <p className="mx-auto mt-4 max-w-xl text-muted">{intro}</p>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <ArchOrnament className="w-20 text-blush" />
      <h2 className="mt-6 text-3xl">{title}</h2>
      {body && <p className="mt-3 text-muted">{body}</p>}
      {action && (
        <Link href={action.href} className="btn-outline mt-8">
          {action.label}
        </Link>
      )}
    </div>
  );
}

const BACKEND_MESSAGES = {
  unconfigured: "The store is not connected to its database yet. Add the Supabase environment variables to load the catalog.",
  schema_missing: "The store is connected to Supabase, but the database has not been set up yet. Run the SQL migrations and the seed script described in the README.",
  update_needed: "The database needs an update before the store can show prices and take orders: run supabase/migrations/0003_gst_sets_sale.sql (see the README).",
  unreachable: "We are having trouble loading the catalog right now. Please try again in a moment.",
} as const;

/** Says plainly when the catalog cannot be loaded, rather than showing an unexplained empty shop. */
export async function SetupNotice() {
  const status = await getBackendStatus();
  if (status === "ok") return null;
  return (
    <div role="status" className="border-b border-blush bg-blush/60 px-5 py-3 text-center text-sm text-cocoa">
      {BACKEND_MESSAGES[status]}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-x-2">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-copper-dark">{item.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-cocoa">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
