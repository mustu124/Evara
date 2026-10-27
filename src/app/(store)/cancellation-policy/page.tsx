import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "How to cancel or change an Evara Studios order.",
  alternates: { canonical: "/cancellation-policy" },
};

// The text is edited in Admin -> Policies.
export default function CancellationPolicyRoute() {
  return <PolicyPage policy="cancellation" />;
}
