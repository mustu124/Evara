import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/store/bits";
import { ProductListing, type ListingSearchParams } from "@/components/store/product-listing";
import { getCategories } from "@/lib/data/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ListingSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description || `Shop ${category.name.toLowerCase()} by Evara Studios: artisan candles handcrafted in wax, with your choice of design, hue and scent.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const parent = categories.find((c) => c.id === category.parent_id);

  return (
    <>
      <PageHeader
        eyebrow={category.is_coming_soon ? "Coming soon" : (parent?.name ?? "Category")}
        title={category.name}
        intro={category.description || undefined}
      >
      </PageHeader>
      <div className="container-x py-10 sm:py-14">
        <div className="mb-8">
          <Breadcrumbs
            items={[
              { href: "/shop", label: "Shop" },
              ...(parent ? [{ href: `/categories/${parent.slug}`, label: parent.name }] : []),
              { label: category.name },
            ]}
          />
        </div>
        <ProductListing
          basePath={`/categories/${category.slug}`}
          searchParams={await searchParams}
          fixedCategory={category.slug}
          emptyTitle={category.is_coming_soon ? "Coming soon" : "New pieces on the way"}
          emptyBody={
            category.is_coming_soon
              ? `${category.name} are not available yet. We are working on them.`
              : `We have not listed any ${category.name.toLowerCase()} yet. Please check back soon.`
          }
        />
      </div>
    </>
  );
}
