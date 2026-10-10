import type { Metadata } from "next";
import { AdminHeading, LoadError } from "@/components/admin/bits";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireAdmin } from "@/lib/auth";
import { getAdminTaxonomy } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Collections" };

export default async function AdminCollectionsPage() {
  const { supabase } = await requireAdmin();
  const { collections, error } = await getAdminTaxonomy(supabase);
  return (
    <>
      <AdminHeading title="Collections" description="Themed groups such as Diwali or Valentine's. Add products to a collection from each product's edit page." />
      {error ? <LoadError message={error} /> : <TaxonomyManager kind="collections" items={collections} />}
    </>
  );
}
