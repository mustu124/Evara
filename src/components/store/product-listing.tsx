import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/store/bits";
import { SortSelect } from "@/components/store/filter-bar";
import { ProductGrid } from "@/components/store/product-card";
import { getCategories, getProducts } from "@/lib/data/catalog";
import { AVAILABILITY_OPTIONS, SORT_OPTIONS, type AvailabilityKey, type SortKey } from "@/lib/data/catalog-options";

export type ListingSearchParams = Record<string, string | string[] | undefined>;

type Props = {
  basePath: string;
  searchParams: ListingSearchParams;
  /** Fixed scope for category / collection pages; hides the matching filter. */
  fixedCategory?: string;
  fixedCollection?: string;
  emptyTitle?: string;
  emptyBody?: string;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function ProductListingContent({ basePath, searchParams, fixedCategory, fixedCollection, emptyTitle, emptyBody }: Props) {
  const sort = SORT_OPTIONS.some((o) => o.value === one(searchParams.sort)) ? (one(searchParams.sort) as SortKey) : "featured";
  const availability = AVAILABILITY_OPTIONS.some((o) => o.value === one(searchParams.availability))
    ? (one(searchParams.availability) as AvailabilityKey)
    : "all";
  const values = {
    q: one(searchParams.q).slice(0, 80),
    category: fixedCategory ? "" : one(searchParams.category),
    collection: fixedCollection ? "" : one(searchParams.collection),
    sort,
    availability,
  };

  const [categories, result] = await Promise.all([
    getCategories(),
    getProducts({
      q: values.q,
      categorySlug: fixedCategory ?? (values.category || undefined),
      collectionSlug: fixedCollection ?? (values.collection || undefined),
      sort,
      availability,
      page: Number.parseInt(one(searchParams.page), 10) || 1,
    }),
  ]);

  const selected = values.category ? categories.find((c) => c.slug === values.category) : undefined;
  const filtered = Boolean(values.q || values.category || values.collection || availability !== "all");
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (values.q) params.set("q", values.q);
    if (values.category) params.set("category", values.category);
    if (values.collection) params.set("collection", values.collection);
    if (sort !== "featured") params.set("sort", sort);
    if (availability !== "all") params.set("availability", availability);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Scoped pages with nothing in them yet show their own message, not a filter bar.
  if (result.total === 0 && !filtered && (fixedCategory || fixedCollection)) {
    return <EmptyState title={emptyTitle ?? "Nothing here yet"} body={emptyBody} action={{ href: "/shop", label: "Browse all products" }} />;
  }

  // One compact row of main categories; a main category's sub-categories appear
  // in a second, smaller row only while that category is open.
  const mainCategories = categories.filter((c) => !c.parent_id);
  const activeSlug = fixedCategory ?? values.category;
  const activeCategory = categories.find((c) => c.slug === activeSlug);
  const activeMain = activeCategory?.parent_id ? categories.find((c) => c.id === activeCategory.parent_id) : activeCategory;
  const subCategories = activeMain ? categories.filter((c) => c.parent_id === activeMain.id) : [];
  const comingSoon = categories.filter((c) => c.is_coming_soon);
  const chip = (active: boolean, small = false) =>
    `choice shrink-0 whitespace-nowrap ${small ? "!min-h-9 !gap-1.5 !px-3 text-[0.8rem]" : "!min-h-10 !gap-1.5 !px-3.5 text-[0.85rem]"} ${active ? "choice-selected" : ""}`;
  // Phones and tablets: the row scrolls sideways instead of wrapping down the page.
  // Laptops: everything fits on one line because "coming soon" categories fold into one menu.
  const row = "-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden";
  const soon = <span className="text-xs text-muted">soon</span>;
  const foldOnLaptop = (c: { is_coming_soon: boolean }) => (c.is_coming_soon ? "lg:hidden" : "");

  return (
    <>
      {!fixedCollection && mainCategories.length > 0 && (
        <nav aria-label="Categories" className="mb-8 space-y-2.5">
          <ul className={row}>
            <li>
              <Link href="/shop" className={chip(!activeSlug)} aria-current={!activeSlug ? "page" : undefined}>
                All
              </Link>
            </li>
            {mainCategories.map((c) => {
              const active = activeMain?.id === c.id;
              return (
                <li key={c.id} className={foldOnLaptop(c)}>
                  <Link href={`/shop?category=${c.slug}`} className={chip(active)} aria-current={activeSlug === c.slug ? "page" : undefined}>
                    {c.name}
                    {c.is_coming_soon && soon}
                  </Link>
                </li>
              );
            })}
            {comingSoon.length > 0 && (
              <li className="relative hidden lg:block">
                <details className="group">
                  <summary className={`${chip(Boolean(activeCategory?.is_coming_soon))} list-none [&::-webkit-details-marker]:hidden`}>
                    Coming soon
                    <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="card absolute left-0 top-full z-20 mt-2 w-60 space-y-0.5 p-2 shadow-lift">
                    {comingSoon.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/shop?category=${c.slug}`}
                          aria-current={activeSlug === c.slug ? "page" : undefined}
                          className={`block rounded-lg px-3 py-2 text-sm hover:bg-blush-light ${activeSlug === c.slug ? "bg-blush-light font-medium" : ""}`}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>

          {activeMain && subCategories.length > 0 && (
            <ul className={row} aria-label={`${activeMain.name} types`}>
              <li>
                <Link href={`/shop?category=${activeMain.slug}`} className={chip(activeSlug === activeMain.slug, true)} aria-current={activeSlug === activeMain.slug ? "page" : undefined}>
                  All {activeMain.name}
                </Link>
              </li>
              {subCategories.map((c) => (
                <li key={c.id} className={foldOnLaptop(c)}>
                  <Link href={`/shop?category=${c.slug}`} className={chip(activeSlug === c.slug, true)} aria-current={activeSlug === c.slug ? "page" : undefined}>
                    {c.name}
                    {c.is_coming_soon && soon}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status">
          {result.total} {result.total === 1 ? "product" : "products"}
          {values.q && (
            <>
              {" "}for &ldquo;{values.q}&rdquo; &middot;{" "}
              <Link href={basePath} className="text-copper-dark underline underline-offset-4">clear search</Link>
            </>
          )}
        </p>
        {result.total > 1 && <SortSelect value={sort} />}
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title={selected?.is_coming_soon ? "Coming soon" : selected ? "New pieces on the way" : filtered ? "No matches found" : (emptyTitle ?? "Nothing here yet")}
          body={
            selected
              ? selected.is_coming_soon
                ? `${selected.name} are not available yet. We are working on them.`
                : `We have not listed any ${selected.name.toLowerCase()} yet. Please check back soon.`
              : filtered
                ? "Try a different word, or browse all products instead."
                : (emptyBody ?? "New pieces are on their way.")
          }
          action={filtered ? { href: basePath, label: "View all products" } : undefined}
        />
      ) : (
        <ProductGrid products={result.items} />
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-4">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} rel="prev" className="btn-quiet">Previous</Link>
          ) : (
            <span className="btn-quiet opacity-40" aria-disabled="true">Previous</span>
          )}
          <span className="text-sm text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} rel="next" className="btn-quiet">Next</Link>
          ) : (
            <span className="btn-quiet opacity-40" aria-disabled="true">Next</span>
          )}
        </nav>
      )}
    </>
  );
}

function ListingSkeleton() {
  return (
    <div role="status" aria-label="Loading products">
      <div className="mb-10 h-10 w-2/3 animate-pulse rounded-full bg-blush/40" />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-xl bg-blush/40" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-blush/40" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-blush/30" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Filterable product grid with its own loading state. The Suspense boundary
 * lives here (not in a route-level loading file) so pages can still answer
 * with a real 404 before any content is streamed.
 */
export function ProductListing(props: Props) {
  return (
    <Suspense key={JSON.stringify(props.searchParams)} fallback={<ListingSkeleton />}>
      <ProductListingContent {...props} />
    </Suspense>
  );
}
