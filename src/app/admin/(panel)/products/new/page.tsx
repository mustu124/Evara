import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/bits";
import { ProductForm } from "@/components/admin/product-form";
import { btnSecondary } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { EMPTY_PRODUCT, getAdminTaxonomy } from "@/lib/data/admin";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const { categories, collections } = await getAdminTaxonomy(supabase);
  return (
    <>
      <AdminHeading title="New product" description="Save the product first, then add its photos.">
        <Link href="/admin/products" className={btnSecondary}>Back to products</Link>
      </AdminHeading>
      <ProductForm initial={EMPTY_PRODUCT} categories={categories} collections={collections} />
    </>
  );
}
