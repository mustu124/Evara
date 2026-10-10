import type { Metadata } from "next";
import { PageHeader } from "@/components/store/bits";
import { ProductListing, type ListingSearchParams } from "@/components/store/product-listing";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse all Evara Studios candles — bowl jar candles, shot glass candles and more.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<ListingSearchParams> }) {
  return (
    <>
      <PageHeader eyebrow="Evara Studios" title="Shop" intro="Every piece is handcrafted in wax. Choose your design, hue and scent." />
      <div className="container-x py-8 sm:py-10">
        <ProductListing basePath="/shop" searchParams={await searchParams} />
      </div>
    </>
  );
}
