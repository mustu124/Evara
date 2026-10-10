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
          <div>
            {about.founders.length > 0 && (
              // Large portrait frames in the photos' own 9:16 shape, so nothing is cropped.
              <div className={`mx-auto mb-12 grid w-full gap-4 sm:gap-8 ${about.founders.length === 1 ? "max-w-sm grid-cols-1" : "max-w-[19rem] grid-cols-1 sm:max-w-3xl sm:grid-cols-2"}`}>
                {about.founders.map((f) => (
                  <figure key={f.image_path}>
                    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-blush-light shadow-soft ring-1 ring-line">
                      <StorageImage path={f.image_path} alt={f.name ? `${f.name}, co-founder of ${BRAND.name}` : `${BRAND.name} founder`} sizes="(min-width: 640px) 24rem, 19rem" priority className="object-top" />
                    </div>
                    {f.name && <figcaption className="mt-3 text-center font-serif text-2xl text-cocoa">{f.name}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <article className="prose-evara mx-auto max-w-2xl text-[1.05rem]">
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
