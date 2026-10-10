import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminHeading } from "@/components/admin/bits";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { btnSecondary } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminProduct, getAdminTaxonomy } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Edit product" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string }> };

export default async function EditProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [product, taxonomy, { created, saved }] = await Promise.all([getAdminProduct(supabase, id), getAdminTaxonomy(supabase), searchParams]);
  if (!product) notFound();

  return (
    <>
      <AdminHeading title={product.name}>
        <div className="flex flex-wrap gap-2">
          {product.status === "published" && (
            <Link href={`/shop/${product.slug}`} target="_blank" className={btnSecondary}>
              <ExternalLink aria-hidden className="size-4" /> View on store
            </Link>
          )}
          <Link href="/admin/products" className={btnSecondary}>Back to products</Link>
        </div>
      </AdminHeading>

      {(created || saved) && (
        <p role="status" className="mb-6 rounded-lg border border-line bg-blush-light/60 px-4 py-3 text-sm text-cocoa">
          {created
            ? "Product created. Add its photos below, then set the status to Published when it is ready."
            : "Product saved. The store has been updated."}
        </p>
      )}

      <div className="space-y-6">
        <ProductImages productId={id} images={product.images} options={product.options} />
        {/* Re-keyed after each save so the form reloads the ids stored in the database. */}
        <ProductForm key={saved ?? "initial"} initial={product.form} categories={taxonomy.categories} collections={taxonomy.collections} />
      </div>
    </>
  );
}
