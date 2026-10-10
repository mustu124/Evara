import Link from "next/link";
import { PageHeader } from "@/components/store/bits";

export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Evara Studios" title={title} />
      <article className="prose-evara container-x max-w-3xl py-12 sm:py-16">
        <p className="text-sm text-muted">Last updated: {updated}</p>
        {children}
        <h2>Questions</h2>
        <p>
          If anything here is unclear, please reach us through our <Link href="/contact">contact page</Link> before placing
          your order.
        </p>
      </article>
    </>
  );
}
