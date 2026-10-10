import Link from "next/link";
import { Star } from "lucide-react";
import { ArchOrnament } from "@/components/icons";
import { SectionHeading } from "@/components/store/bits";
import { Hero } from "@/components/store/hero";
import { ProductGrid } from "@/components/store/product-card";
import { StorageImage } from "@/components/store/storage-image";
import {
  getBestsellers,
  getCategories,
  getCollections,
  getGalleryImages,
  getTestimonials,
} from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";

export default async function HomePage() {
  const [settings, categories, collections, bestsellers, gallery, testimonials] = await Promise.all([
    getSettings(),
    getCategories(),
    getCollections(),
    getBestsellers(8),
    getGalleryImages(8),
    getTestimonials(),
  ]);
  const { hero, sections } = settings.homepage;

  // The main category headings (not their sub-categories), in catalog order.
  const mainCategories = categories.filter((c) => !c.parent_id);

  return (
    <>
      <Hero hero={hero} />

      {sections.categories && mainCategories.length > 0 && (
        <section className="section">
          <div className="container-x">
            <SectionHeading eyebrow="Explore" title="Shop by Category" />
            <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {mainCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="group relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-ivory p-4 text-center shadow-soft transition-[box-shadow,border-color] duration-300 hover:border-copper/50 hover:shadow-lift"
                  >
                    {c.image_path ? (
                      <>
                        <StorageImage path={c.image_path} alt="" sizes="(min-width: 1024px) 33vw, 50vw" className="transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute inset-x-0 bottom-0 p-4 text-left font-serif text-xl text-ivory sm:p-6 sm:text-3xl">
                          {c.name}
                          {c.is_coming_soon && <span className="mt-0.5 block font-sans text-xs">Coming soon</span>}
                        </span>
                      </>
                    ) : (
                      <>
                        <ArchOrnament className="w-10 text-copper-dark sm:w-12" />
                        <span className="mt-3 font-serif text-xl text-cocoa sm:text-[1.7rem]">{c.name}</span>
                        <span className="mt-1 text-xs text-muted sm:text-sm">{c.is_coming_soon ? "Coming soon" : "Explore"}</span>
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.bestsellers && bestsellers.length > 0 && (
        <section className="section bg-blush-light">
          <div className="container-x">
            <SectionHeading eyebrow="Favourites" title="Our Bestsellers" />
            <ProductGrid products={bestsellers} />
            <div className="mt-12 text-center">
              <Link href="/shop" className="btn-outline">View all products</Link>
            </div>
          </div>
        </section>
      )}

      {sections.collections && collections.length > 0 && (
        <section className="section">
          <div className="container-x">
            <SectionHeading eyebrow="For every occasion" title="Shop by Collection" />
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
                        <ArchOrnament className="w-12 text-copper/70 transition-transform duration-500 group-hover:-translate-y-0.5" />
                        <span className="mt-3 font-serif text-xl text-cocoa sm:text-[1.7rem]">{c.name}</span>
                        <span className="eyebrow mt-2 !text-[0.6rem]">Explore</span>
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.gallery && gallery.length > 0 && (
        <section className="section bg-blush-light">
          <div className="container-x">
            <SectionHeading eyebrow="Gallery" title="Styled for You" />
            <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {gallery.map((g) => (
                <li key={g.id}>
                  <Link href={`/shop/${g.product.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-xl bg-blush" aria-label={`View ${g.product.name}`}>
                    <StorageImage path={g.storage_path} alt={g.alt || g.product.name} sizes="(min-width: 1024px) 25vw, 50vw" className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                    <span aria-hidden className="absolute inset-x-0 bottom-0 translate-y-full bg-ivory/95 px-4 py-3 text-center font-serif text-lg text-cocoa transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
                      {g.product.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.testimonials && testimonials.length > 0 && (
        <section className="section">
          <div className="container-x">
            <SectionHeading title="What Our Customers Say" />
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <li key={t.id} className="card flex flex-col p-7">
                  {t.rating && (
                    <p className="mb-4 flex gap-0.5 text-copper-dark" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: t.rating }, (_, i) => (
                        <Star key={i} aria-hidden className="size-4 fill-current" />
                      ))}
                    </p>
                  )}
                  <blockquote className="flex-1 font-serif text-xl leading-relaxed text-cocoa">&ldquo;{t.quote}&rdquo;</blockquote>
                  <p className="mt-5 text-sm font-medium text-cocoa">
                    {t.author_name}
                    {t.author_location && <span className="block font-normal text-muted">{t.author_location}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
