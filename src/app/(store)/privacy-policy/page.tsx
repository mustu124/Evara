import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Evara Studios collects, uses and protects your information.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Privacy Policy" updated="October 2026">
      <p>
        Evara Studios respects your privacy. This policy explains what information we collect when you use this website
        and how we use it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Order details you give us:</strong> your name, mobile number, delivery address, optional email address
          and any note you add when you place an order request.
        </li>
        <li>
          <strong>Your cart:</strong> the items in your cart are stored in your own browser so they are still there when
          you return. They are not sent to us until you place an order request.
        </li>
        <li>
          <strong>Technical information:</strong> our hosting provider keeps standard server logs. To prevent misuse of
          the order form we store a hashed fingerprint of the network address an order was placed from.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To prepare, confirm and deliver your order, and to contact you about it.</li>
        <li>To respond to questions you send us.</li>
        <li>To protect the website and our customers from fraud and abuse.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for advertising.</p>

      <h2>WhatsApp and other services</h2>
      <p>
        Orders are sent to us through WhatsApp. When you tap the WhatsApp button, your order message is opened in
        WhatsApp and handled under WhatsApp&rsquo;s own terms and privacy policy. Our website and database are hosted with
        third-party infrastructure providers who process data on our behalf. We share your delivery details with a
        courier only as needed to deliver your order.
      </p>

      <h2>Payments</h2>
      <p>
        This website does not take online payments and never asks for card or bank details. Payment is arranged with us
        directly after we confirm your order.
      </p>

      <h2>Keeping and deleting your information</h2>
      <p>
        We keep order records for as long as needed to fulfil orders and meet our legal and accounting obligations. You
        can ask us to correct or delete your personal information by contacting us, and we will do so unless we are
        required to keep it.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy from time to time. The date at the top shows when it last changed.</p>
    </PolicyPage>
  );
}
