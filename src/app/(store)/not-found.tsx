import type { Metadata } from "next";
import { EmptyState } from "@/components/store/bits";

export const metadata: Metadata = { title: "Page not found" };

export default function StoreNotFound() {
  return (
    <div className="container-x py-10">
      <EmptyState
        title="This page has melted away"
        body="The page you are looking for does not exist or has been moved."
        action={{ href: "/shop", label: "Browse the shop" }}
      />
    </div>
  );
}
