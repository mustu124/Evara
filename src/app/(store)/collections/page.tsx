import type { Metadata } from "next";
import Link from "next/link";
import { ArchOrnament } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/store/bits";
import { StorageImage } from "@/components/store/storage-image";
import { getCollections } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Collections",
  description: "Evara Studios collections for every occasion.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const collections = await getCollections();
  return (
    <>
      <PageHeader eyebrow="For every occasion" title="Collections" />
      <div className="container-x py-12 sm:py-16">
        {collections.length === 0 ? (
          <EmptyState title="Collections are on their way" action={{ href: "/shop", label: "Browse all products" }} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
            {collections.map((c) => (
              <li key={c.id}>
                <Link href={`/collections/${c.slug}`} className="group relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-blush-light p-4 text-center shadow-soft transition-colors hover:border-blush">
                  {c.image_path ? (
                    <>
                      <StorageImage path={c.image_path} alt="" sizes="(min-width: 1024px) 33vw, 50vw" className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-5 text-left font-serif text-2xl text-ivory sm:p-6 sm:text-3xl">{c.name}</span>
                    </>
                  ) : (
                    <>
                      <ArchOrnament className="w-12 text-copper/70" />
                      <span className="mt-3 font-serif text-xl text-cocoa sm:text-[1.7rem]">{c.name}</span>
                      <span className="eyebrow mt-2 !text-[0.6rem]">Explore</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
