import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminEmpty, AdminHeading, Badge, LoadError, ProductStatusBadge } from "@/components/admin/bits";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { adminInput, btnPrimary, btnSecondary } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatINR, imageUrl } from "@/lib/format";
import type { ProductStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

type Row = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  is_coming_soon: boolean;
  is_bestseller: boolean;
  category: { name: string } | { name: string }[] | null;
  variants: { price: number }[];
  images: { storage_path: string; sort_order: number }[];
};

const STATUSES = ["all", "published", "draft", "archived"] as const;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").replace(/[^\p{L}\p{N}\s&'-]/gu, " ").trim().slice(0, 80);
  const status = STATUSES.find((s) => s === params.status) ?? "all";

  let request = supabase
    .from("products")
    .select("id, name, slug, status, is_coming_soon, is_bestseller, category:categories ( name ), variants:product_variants ( price ), images:product_images ( storage_path, sort_order )")
    .order("sort_order")
    .order("name")
    .limit(500);
  if (status !== "all") request = request.eq("status", status);
  else request = request.neq("status", "archived");
  if (q) request = request.ilike("name", `%${q.replace(/\s+/g, "%")}%`);

  const { data, error } = await request;
  const products = (data ?? []) as unknown as Row[];

  return (
    <>
      <AdminHeading title="Products" description="Create, edit, publish and archive the products shown on the store.">
        <Link href="/admin/products/new" className={btnPrimary}>
          <Plus aria-hidden className="size-4" /> New product
        </Link>
      </AdminHeading>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="sr-only">Search products</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name" className={adminInput} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">Status</label>
          <select id="status" name="status" defaultValue={status} className={adminInput}>
            <option value="all">Active (draft + published)</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button type="submit" className={btnSecondary}>Filter</button>
      </form>

      {error ? (
        <LoadError message={error.message} />
      ) : products.length === 0 ? (
        <AdminEmpty title={q || status !== "all" ? "No products match" : "No products yet"} body={q || status !== "all" ? "Try a different search or status." : "Run the seed script to load the Evara catalog, or create your first product."}>
          <Link href="/admin/products/new" className={btnPrimary}>New product</Link>
        </AdminEmpty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-ivory shadow-soft">
          {products.map((p) => {
            const image = [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0];
            const src = imageUrl(image?.storage_path);
            const prices = p.variants.map((v) => Number(v.price));
            const category = Array.isArray(p.category) ? p.category[0] : p.category;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap sm:p-4">
                <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-lg bg-blush">
                  {src && <Image src={src} alt="" fill sizes="52px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="font-medium text-cocoa hover:text-copper-dark">{p.name}</Link>
                  <p className="truncate text-xs text-muted">
                    {category?.name ?? "No category"} ·{" "}
                    {prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatINR(prices[0]) : `${formatINR(Math.min(...prices))} – ${formatINR(Math.max(...prices))}`) : "No price"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <ProductStatusBadge status={p.status} />
                    {p.is_coming_soon && <Badge tone="rose">Coming soon</Badge>}
                    {p.is_bestseller && <Badge tone="blue">Bestseller</Badge>}
                  </div>
                </div>
                <ProductRowActions id={p.id} name={p.name} status={p.status} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
