import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Evara Studios collects, uses and protects your information.",
  alternates: { canonical: "/privacy-policy" },
};

// The text is edited in Admin -> Policies.
export default function PrivacyPolicyRoute() {
  return <PolicyPage policy="privacy" />;
}
