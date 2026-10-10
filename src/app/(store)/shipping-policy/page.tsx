import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "How Evara Studios orders are prepared, packed and delivered.",
  alternates: { canonical: "/shipping-policy" },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPage title="Shipping Policy" updated="October 2026">
      <p>
        Our candles are handcrafted, so every order is prepared with care. Delivery details for each order are agreed
        with you on WhatsApp before you pay.
      </p>

      <h2>Delivery charges</h2>
      <p>
        If a delivery charge applies to your order, it is either shown in your order summary or confirmed with you on
        WhatsApp before payment. You will always know the full amount before you pay.
      </p>

      <h2>Preparation and delivery time</h2>
      <p>
        Preparation time depends on the pieces you choose and whether they are ready or made for your order. We will
        tell you the expected dispatch and delivery timeline when we confirm your order on WhatsApp.
      </p>

      <h2>Delivery address</h2>
      <p>
        Please make sure the name, mobile number and address you provide are complete and correct. We are not
        responsible for delays or failed deliveries caused by incorrect details. If you need to change your address,
        message us as soon as possible and before your order is dispatched.
      </p>

      <h2>Packaging and handling</h2>
      <p>
        Candles are fragile and sensitive to heat. We pack each order carefully, but wax can soften in very warm
        conditions during transit. Please bring your parcel indoors promptly and keep candles away from direct sunlight.
      </p>

      <h2>Damaged or incorrect items</h2>
      <p>
        If your order arrives damaged or is not what you ordered, please message us on WhatsApp with your order
        reference and clear photographs of the item and its packaging as soon as you can after delivery, so that we can
        make it right.
      </p>
    </PolicyPage>
  );
}
