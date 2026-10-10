import type { Metadata } from "next";
import { AdminHeading, LoadError } from "@/components/admin/bits";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireAdmin } from "@/lib/auth";
import { getAdminTaxonomy } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const { supabase } = await requireAdmin();
  const { categories, error } = await getAdminTaxonomy(supabase);
  return (
    <>
      <AdminHeading title="Categories" description="Organise products by type. Categories with an image appear as picture cards on the homepage; turn off Coming soon to open a category." />
      {error ? <LoadError message={error} /> : <TaxonomyManager kind="categories" items={categories} />}
    </>
  );
}
