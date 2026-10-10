import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your Evara Studios cart and send your order on WhatsApp.",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <div className="container-x py-10 sm:py-14">
      <h1 className="mb-8 text-4xl sm:text-5xl">Cart</h1>
      <CartView />
    </div>
  );
}
