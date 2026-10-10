import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/store/bits";
import { StorageImage } from "@/components/store/storage-image";
import { getSettings } from "@/lib/data/settings";
import { BRAND } from "@/lib/env";

export const metadata: Metadata = {
  title: "Our Story",
  description: "How two friends on the CA journey discovered candle-making and started Evara Studios.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const { about } = await getSettings();
  const paragraphs = about.story.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <PageHeader eyebrow="Founders' story" title="How Evara happened" />
      <div className="container-x py-12 sm:py-20">
        {paragraphs.length === 0 ? (
          <EmptyState title="Our story is coming soon" action={{ href: "/shop", label: "Browse the shop" }} />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
            {about.founders.length > 0 && (
              <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-4 lg:sticky lg:top-28 lg:max-w-none lg:grid-cols-1 lg:gap-8 lg:self-start">
                {about.founders.map((f) => (
                  <figure key={f.image_path}>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-blush/40 shadow-soft ring-1 ring-line">
                      <StorageImage path={f.image_path} alt={f.name ? `${f.name}, co-founder of ${BRAND.name}` : `${BRAND.name} founder`} sizes="(min-width: 1024px) 20rem, 45vw" priority />
                    </div>
                    {f.name && <figcaption className="mt-3 text-center font-serif text-xl text-cocoa">{f.name}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <article className={`prose-evara max-w-2xl text-[1.05rem] ${about.founders.length === 0 ? "mx-auto lg:col-span-2" : ""}`}>
              {paragraphs.map((p, i) =>
                i === 0 ? (
                  <p key={i} className="!mb-8 font-serif text-2xl !leading-snug text-cocoa sm:text-3xl">{p}</p>
                ) : (
                  <p key={i} className="whitespace-pre-line">{p}</p>
                ),
              )}
              <Link href="/shop" className="btn-primary mt-4 !text-white !no-underline">Shop the candles</Link>
            </article>
          </div>
        )}
      </div>
    </>
  );
}
