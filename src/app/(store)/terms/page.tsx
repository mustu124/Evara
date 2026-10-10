import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply when you browse and order from Evara Studios.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PolicyPage title="Terms & Conditions" updated="October 2026">
      <p>
        By using this website or placing an order request with Evara Studios, you agree to the terms below.
      </p>

      <h2>How ordering works</h2>
      <ul>
        <li>Adding items to your cart and submitting your details creates an order <em>request</em> with a reference number.</li>
        <li>The request reaches us when you send the prepared message on WhatsApp.</li>
        <li>
          An order is accepted only when we confirm it to you on WhatsApp. Until then no contract exists and no payment
          is due.
        </li>
        <li>We may decline a request, for example if an item is unavailable or we cannot deliver to your address.</li>
      </ul>

      <h2>Prices and payment</h2>
      <p>
        Prices are shown in Indian Rupees (₹). The total shown at checkout is calculated from our current prices; any
        delivery charge is confirmed with you on WhatsApp before you pay. No payment is taken on this website. Payment
        details are shared with you directly when we confirm your order.
      </p>

      <h2>Handcrafted products</h2>
      <p>
        Every Evara candle is made by hand. Small variations in colour, shape, finish and fragrance intensity are a
        natural part of the craft and are not defects. Product photographs are of real pieces, but colours can look
        slightly different on different screens. Dimensions, wax weights and burn times are approximate.
      </p>

      <h2>Availability</h2>
      <p>
        Items marked &ldquo;Coming soon&rdquo; cannot be ordered yet. Listed items may occasionally become unavailable;
        if that happens after you send a request we will let you know before confirming.
      </p>

      <h2>Using candles safely</h2>
      <ul>
        <li>Never leave a burning candle unattended.</li>
        <li>Keep candles away from children, pets, curtains and anything that can catch fire.</li>
        <li>Burn on a stable, heat-resistant surface and away from draughts.</li>
        <li>Decorative wax pieces on a candle can melt and burn; stop using the candle if the flame becomes too large.</li>
      </ul>
      <p>You are responsible for using our products safely.</p>

      <h2>Delivery, cancellations and returns</h2>
      <p>
        Please read our <Link href="/shipping-policy">Shipping Policy</Link> and{" "}
        <Link href="/cancellation-policy">Cancellation Policy</Link>, which form part of these terms.
      </p>

      <h2>Website content</h2>
      <p>
        The Evara name, logo, photographs and text on this website belong to Evara Studios and may not be used without
        permission.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms. The version published here when you place an order request applies to that order.</p>
    </PolicyPage>
  );
}
