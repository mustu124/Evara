import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "How Evara Studios orders are prepared, packed and delivered.",
  alternates: { canonical: "/shipping-policy" },
};

// The text is edited in Admin -> Policies.
export default function ShippingPolicyRoute() {
  return <PolicyPage policy="shipping" />;
}
