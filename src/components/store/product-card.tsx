import Link from "next/link";
import { StorageImage } from "@/components/store/storage-image";
import { formatINR, isVariantOrderable, productAvailability, startingPrice } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";

const BADGES = {
  coming_soon: "Coming soon",
  out_of_stock: "Out of stock",
  unavailable: "Unavailable",
} as const;

export function ProductCard({ product, priority }: { product: ProductSummary; priority?: boolean }) {
  const availability = productAvailability(product);
  const from = startingPrice(product.variants);
  const hasRange = new Set(product.variants.filter(isVariantOrderable).map((v) => v.price)).size > 1;
  const image = product.images[0];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-ivory shadow-soft transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-copper/50 hover:shadow-lift">
      <div className="relative aspect-[4/5] overflow-hidden bg-blush-light">
        <StorageImage
          path={image?.storage_path}
          alt={image?.alt || product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        {availability !== "available" && (
          <span className="absolute left-3 top-3 rounded-full bg-ivory/95 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-cocoa">
            {BADGES[availability]}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {product.category && <p className="text-xs text-muted">{product.category.name}</p>}
        <h3 className="mt-1 text-[1.4rem] leading-snug">
          {/* The stretched link makes the whole card, image included, open the product. */}
          <Link href={`/shop/${product.slug}`} className="text-cocoa after:absolute after:inset-0 after:rounded-xl">
            {product.name}
          </Link>
        </h3>
        {from && (
          <p className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
            <span className="text-base font-semibold text-copper">
              {hasRange ? "From " : ""}
              {formatINR(from.price)}
            </span>
            {from.compare_at_price !== null && from.compare_at_price > from.price && (
              <s className="text-sm text-muted"><span className="sr-only">Was </span>{formatINR(from.compare_at_price)}</s>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <ul className={`grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 ${products.length === 5 ? "lg:grid-cols-5 lg:gap-5" : "lg:grid-cols-4"}`}>
      {products.map((p, i) => (
        <li key={p.id} className="h-full">
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
