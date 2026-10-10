import { SetupNotice } from "@/components/store/bits";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { getCategories, getCollections } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";

// Storefront pages are cached and regenerated at most every 5 minutes; every
// admin change additionally purges the cache so edits appear immediately.
export const revalidate = 300;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, collections, settings] = await Promise.all([getCategories(), getCollections(), getSettings()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SetupNotice />
      <SiteHeader categories={categories} collections={collections} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter categories={categories} store={settings.store} />
    </div>
  );
}
