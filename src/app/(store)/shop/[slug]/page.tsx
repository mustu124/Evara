import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/bits";
import { ProductGrid } from "@/components/store/product-card";
import { ProductPurchase } from "@/components/store/product-purchase";
import { getAllProductSlugs, getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { BRAND, siteUrl } from "@/lib/env";
import { imageUrl, isVariantOrderable, productAvailability } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

// Pre-render known products; new ones are rendered on first visit and cached.
export async function generateStaticParams() {
  return (await getAllProductSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const image = imageUrl(product.images[0]?.storage_path);
  const description = product.description.slice(0, 200) || `${product.name} by ${BRAND.name}.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/shop/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  const prices = product.variants.filter(isVariantOrderable).map((v) => v.price);
  const availability = productAvailability(product);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => imageUrl(i.storage_path)).filter(Boolean),
    brand: { "@type": "Brand", name: BRAND.name },
    category: product.category?.name,
    url: `${siteUrl}/shop/${product.slug}`,
    ...(prices.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
        availability:
          availability === "available"
            ? "https://schema.org/InStock"
            : availability === "coming_soon"
              ? "https://schema.org/PreOrder"
              : "https://schema.org/OutOfStock",
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x py-10 sm:py-14">
        <ProductPurchase product={product}>
          <Breadcrumbs
            items={[
              { href: "/shop", label: "Shop" },
              ...(product.category ? [{ href: `/categories/${product.category.slug}`, label: product.category.name }] : []),
              { label: product.name },
            ]}
          />
        </ProductPurchase>

        {(product.specifications.length > 0 || product.collections.length > 0 || product.description) && (
          <section className="mx-auto mt-12 max-w-3xl border-t border-line pt-10" aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-center text-3xl">Product Specifications</h2>
            {product.specifications.length > 0 && (
              <dl className="mt-8 divide-y divide-line border-y border-line">
                {product.specifications.map((s) => (
                  <div key={s.label} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
                    <dt className="text-sm font-medium text-muted">{s.label}</dt>
                    <dd className="text-cocoa">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {product.description && (
              <div className="mt-10">
                <h2 className="text-center text-3xl">Description</h2>
                <p className="mt-5 text-center leading-relaxed text-cocoa/90">{product.description}</p>
              </div>
            )}
            {product.collections.length > 0 && (
              <p className="mt-6 text-center text-sm text-muted">
                Part of:{" "}
                {product.collections.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/collections/${c.slug}`} className="text-copper-dark underline underline-offset-4">{c.name}</Link>
                  </span>
                ))}
              </p>
            )}
            <p className="mt-6 text-center text-sm text-muted">
              Each candle is handcrafted, so small variations in colour and finish are natural. Prices are inclusive of
              applicable GST.
            </p>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="section bg-blush-light" aria-labelledby="related-heading">
          <div className="container-x">
            <span aria-hidden className="mb-4 block h-px w-12 bg-copper" />
            <h2 id="related-heading" className="mb-10 text-3xl sm:text-4xl">You May Also Like</h2>
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </>
  );
}
