import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/bits";
import { AboutEditor, BestsellerPicker, HomepageEditor, TestimonialsManager } from "@/components/admin/homepage-editors";
import { Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { fetchSettings } from "@/lib/data/settings";
import type { ProductStatus, Testimonial } from "@/lib/types";

export const metadata: Metadata = { title: "Homepage" };

export default async function AdminHomepagePage() {
  const { supabase } = await requireAdmin();
  const [settings, products, testimonials] = await Promise.all([
    fetchSettings(supabase),
    supabase.from("products").select("id, name, status, is_bestseller").neq("status", "archived").order("name").limit(500),
    supabase.from("testimonials").select("*").order("sort_order").order("created_at"),
  ]);

  return (
    <>
      <AdminHeading title="Homepage" description="Control what appears on the store's home page. Each block saves separately." />
      <div className="space-y-6">
        <HomepageEditor initial={settings.homepage} />
        <BestsellerPicker products={(products.data ?? []) as { id: string; name: string; status: ProductStatus; is_bestseller: boolean }[]} />
        <Panel title="Category and collection images" description="Categories with an image appear as picture cards in Shop by Category; collection images fill the Shop by Collection cards.">
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/categories" className="text-copper-dark underline underline-offset-4">Manage category images</Link>
            <Link href="/admin/collections" className="text-copper-dark underline underline-offset-4">Manage collection images</Link>
            <span className="text-muted">Gallery photos are chosen per product, under Products → Images.</span>
          </div>
        </Panel>
        <AboutEditor initial={settings.about} />
        <TestimonialsManager testimonials={(testimonials.data ?? []) as Testimonial[]} />
      </div>
    </>
  );
}
