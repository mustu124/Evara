import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/store/bits";
import { ProductListing, type ListingSearchParams } from "@/components/store/product-listing";
import { getCollections } from "@/lib/data/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ListingSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = (await getCollections()).find((c) => c.slug === slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.name,
    description: collection.description || `The ${collection.name} collection by Evara Studios.`,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = (await getCollections()).find((c) => c.slug === slug);
  if (!collection) notFound();

  return (
    <>
      <PageHeader eyebrow="Collection" title={collection.name} intro={collection.description || undefined} />
      <div className="container-x py-10 sm:py-14">
        <div className="mb-8">
          <Breadcrumbs items={[{ href: "/collections", label: "Collections" }, { label: collection.name }]} />
        </div>
        <ProductListing
          basePath={`/collections/${collection.slug}`}
          searchParams={await searchParams}
          fixedCollection={collection.slug}
          emptyTitle="To be unveiled"
          emptyBody={`Pieces for the ${collection.name} collection have not been listed yet. Please check back soon.`}
        />
      </div>
    </>
  );
}
