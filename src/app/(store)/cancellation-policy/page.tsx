import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "How to cancel or change an Evara Studios order.",
  alternates: { canonical: "/cancellation-policy" },
};

export default function CancellationPolicyPage() {
  return (
    <PolicyPage title="Cancellation Policy" updated="October 2026">
      <p>
        We understand that plans change. Because our candles are handcrafted, how we can help depends on how far along
        your order is.
      </p>

      <h2>Before your order is confirmed</h2>
      <p>
        An order request that we have not yet confirmed on WhatsApp can be cancelled at any time, at no cost. Simply
        tell us on WhatsApp, or do not proceed with payment. Requests that are never sent or confirmed are not treated
        as orders.
      </p>

      <h2>After your order is confirmed</h2>
      <p>
        To cancel or change a confirmed order, message us on WhatsApp with your order reference as early as possible.
        If we have not started preparing your order we will do our best to accommodate the request. Once preparation
        has begun or the order has been dispatched, cancellation may not be possible.
      </p>

      <h2>Refunds</h2>
      <p>
        If a paid order is cancelled with our agreement, or we are unable to fulfil it, we will arrange a refund with
        you directly on WhatsApp using the method you paid with.
      </p>

      <h2>Returns</h2>
      <p>
        As candles are handcrafted and can be made to your chosen design, hue and scent, we are generally unable to
        accept returns for a change of mind. If an item arrives damaged or incorrect, please see our Shipping Policy
        and contact us so that we can resolve it.
      </p>

      <h2>Cancellations by Evara Studios</h2>
      <p>
        We may cancel an order if an item becomes unavailable, if we cannot deliver to your location, or if we are
        unable to reach you to confirm details. Any amount you have paid for a cancelled order will be refunded.
      </p>
    </PolicyPage>
  );
}
