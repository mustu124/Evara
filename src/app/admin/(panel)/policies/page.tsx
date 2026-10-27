import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/bits";
import { PoliciesEditor } from "@/components/admin/policies-editor";
import { requireAdmin } from "@/lib/auth";
import { normalizePolicies } from "@/lib/policies";

export const metadata: Metadata = { title: "Policies" };

export default async function AdminPoliciesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "policies").maybeSingle();
  return (
    <>
      <AdminHeading
        title="Policies"
        description="Edit the Privacy Policy, Terms & Conditions, Shipping Policy and Cancellation Policy. Each saves separately and updates its page straight away, with today's date as the last-updated date."
      />
      <PoliciesEditor policies={normalizePolicies(data?.value ?? null)} />
    </>
  );
}
