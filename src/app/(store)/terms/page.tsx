import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply when you browse and order from Evara Studios.",
  alternates: { canonical: "/terms" },
};

// The text is edited in Admin -> Policies.
export default function TermsPolicyRoute() {
  return <PolicyPage policy="terms" />;
}
