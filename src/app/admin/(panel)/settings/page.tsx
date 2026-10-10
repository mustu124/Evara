import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/bits";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/auth";
import { fetchSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const { store } = await fetchSettings(supabase);
  return (
    <>
      <AdminHeading title="Settings" description="Store-wide details used across the website and in WhatsApp orders." />
      {!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <p role="alert" className="mb-6 rounded-lg border border-blush bg-blush/40 px-4 py-3 text-sm text-cocoa">
          The server secret key is not configured, so customers cannot place orders yet. Add SUPABASE_SECRET_KEY to the
          deployment&rsquo;s environment variables.
        </p>
      )}
      <SettingsForm initial={store} envFallback={Boolean(process.env.WHATSAPP_NUMBER)} />
    </>
  );
}
