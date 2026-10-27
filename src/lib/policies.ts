/**
 * The four policy pages. Their text is editable in Admin -> Policies and
 * stored in site_settings under "policies"; the text below is what each page
 * shows until it has been edited.
 *
 * Formatting understood by the pages (kept deliberately small):
 *   ## Heading           a section heading
 *   - item               a bulleted list (consecutive lines)
 *   **bold**             bold text
 *   [text](/contact)     a link (site paths or https:// addresses)
 *   a blank line         starts a new paragraph
 */

export const POLICY_KEYS = ["privacy", "terms", "shipping", "cancellation"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export type Policy = { body: string; updated_at: string | null };
export type Policies = Record<PolicyKey, Policy>;

export const POLICY_META: Record<PolicyKey, { title: string; path: string }> = {
  privacy: { title: "Privacy Policy", path: "/privacy-policy" },
  terms: { title: "Terms & Conditions", path: "/terms" },
  shipping: { title: "Shipping Policy", path: "/shipping-policy" },
  cancellation: { title: "Cancellation Policy", path: "/cancellation-policy" },
};

export const DEFAULT_POLICIES: Record<PolicyKey, string> = {
  privacy: `Evara Studios respects your privacy. This policy explains what information we collect when you use this website and how we use it.

## Information we collect

- **Order details you give us:** your name, mobile number, delivery address, optional email address and GSTIN, and any note you add when you place an order request.
- **Your cart:** the items in your cart are stored in your own browser so they are still there when you return. They are not sent to us until you place an order request.
- **Technical information:** our hosting provider keeps standard server logs. To prevent misuse of the order form we store a hashed fingerprint of the network address an order was placed from.

## How we use it

- To prepare, confirm and deliver your order, and to contact you about it.
- To respond to questions you send us.
- To protect the website and our customers from fraud and abuse.

We do not sell your personal information, and we do not use it for advertising.

## WhatsApp and other services

Orders are sent to us through WhatsApp. When you tap the WhatsApp button, your order message is opened in WhatsApp and handled under WhatsApp's own terms and privacy policy. Our website and database are hosted with third-party infrastructure providers who process data on our behalf. We share your delivery details with a courier only as needed to deliver your order.

## Payments

This website does not take online payments and never asks for card or bank details. After we confirm your order on WhatsApp, payment is made via UPI using the QR code we share with you there.

## Keeping and deleting your information

We keep order records for as long as needed to fulfil orders and meet our legal and accounting obligations. You can ask us to correct or delete your personal information by contacting us, and we will do so unless we are required to keep it.

## Changes

We may update this policy from time to time. The date at the top shows when it last changed.`,

  terms: `By using this website or placing an order request with Evara Studios, you agree to the terms below.

## How ordering works

- Adding items to your cart and submitting your details creates an order request with a reference number.
- The request reaches us when you send the prepared message on WhatsApp.
- An order is accepted only when we confirm it to you on WhatsApp. Until then no contract exists and no payment is due.
- We may decline a request, for example if an item is unavailable or we cannot deliver to your address.

## Prices and payment

Prices are shown in Indian Rupees (₹) and are inclusive of applicable GST. The total shown at checkout is calculated from our current prices and includes the shipping charge. No payment is taken on this website: once we confirm your order on WhatsApp, payment is made via UPI using the QR code we share with you.

## Handcrafted products

Every Evara candle is made by hand. Small variations in colour, shape, finish and fragrance intensity are a natural part of the craft and are not defects. Product photographs are of real pieces, but colours can look slightly different on different screens. Dimensions, wax weights and burn times are approximate.

## Availability

Items marked "Coming soon" cannot be ordered yet. Listed items may occasionally become unavailable; if that happens after you send a request we will let you know before confirming.

## Using candles safely

- Never leave a burning candle unattended.
- Keep candles away from children, pets, curtains and anything that can catch fire.
- Burn on a stable, heat-resistant surface and away from draughts.
- Decorative wax pieces on a candle can melt and burn; stop using the candle if the flame becomes too large.

You are responsible for using our products safely.

## Delivery, cancellations and returns

Please read our [Shipping Policy](/shipping-policy) and [Cancellation Policy](/cancellation-policy), which form part of these terms.

## Website content

The Evara name, logo, photographs and text on this website belong to Evara Studios and may not be used without permission.

## Changes to these terms

We may update these terms. The version published here when you place an order request applies to that order.`,

  shipping: `Our candles are handcrafted, so every order is prepared with care. Delivery details for each order are agreed with you on WhatsApp before you pay.

## Delivery charges

A flat shipping charge is added once to each order and shown in your order summary before you place it. You will always know the full amount before you pay.

## Preparation and delivery time

Preparation time depends on the pieces you choose and whether they are ready or made for your order. We will tell you the expected dispatch and delivery timeline when we confirm your order on WhatsApp.

## Delivery address

Please make sure the name, mobile number and address you provide are complete and correct. We are not responsible for delays or failed deliveries caused by incorrect details. If you need to change your address, message us as soon as possible and before your order is dispatched.

## Packaging and handling

Candles are fragile and sensitive to heat. We pack each order carefully, but wax can soften in very warm conditions during transit. Please bring your parcel indoors promptly and keep candles away from direct sunlight.

## Damaged or incorrect items

If your order arrives damaged or is not what you ordered, please message us on WhatsApp with your order reference and clear photographs of the item and its packaging as soon as you can after delivery, so that we can make it right.`,

  cancellation: `We understand that plans change. Because our candles are handcrafted, how we can help depends on how far along your order is.

## Before your order is confirmed

An order request that we have not yet confirmed on WhatsApp can be cancelled at any time, at no cost. Simply tell us on WhatsApp, or do not proceed with payment. Requests that are never sent or confirmed are not treated as orders.

## After your order is confirmed

To cancel or change a confirmed order, message us on WhatsApp with your order reference as early as possible. If we have not started preparing your order we will do our best to accommodate the request. Once preparation has begun or the order has been dispatched, cancellation may not be possible.

## Refunds

If a paid order is cancelled with our agreement, or we are unable to fulfil it, we will arrange a refund with you directly on WhatsApp.

## Returns

As candles are handcrafted and can be made to your chosen design, hue and scent, we are generally unable to accept returns for a change of mind. If an item arrives damaged or incorrect, please see our [Shipping Policy](/shipping-policy) and contact us so that we can resolve it.

## Cancellations by Evara Studios

We may cancel an order if an item becomes unavailable, if we cannot deliver to your location, or if we are unable to reach you to confirm details. Any amount you have paid for a cancelled order will be refunded.`,
};

/** Stored policies merged over the defaults, so a page is never empty. */
export function normalizePolicies(value: unknown): Policies {
  const stored = value && typeof value === "object" ? (value as Record<string, { body?: unknown; updated_at?: unknown }>) : {};
  return Object.fromEntries(
    POLICY_KEYS.map((key) => {
      const s = stored[key];
      const body = typeof s?.body === "string" && s.body.trim() ? s.body : DEFAULT_POLICIES[key];
      const updated_at = typeof s?.updated_at === "string" ? s.updated_at : null;
      return [key, { body, updated_at }];
    }),
  ) as Policies;
}

export type Inline = { type: "text" | "bold"; text: string } | { type: "link"; text: string; href: string };
export type Block = { type: "h2"; text: string } | { type: "p"; inline: Inline[] } | { type: "ul"; items: Inline[][] };

const SAFE_HREF = /^(\/[\w\-/#?=&.%]*|https:\/\/[^\s)]+|mailto:[^\s)]+)$/;

/** **bold** and [text](href) inside a line. Anything else is plain text. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of line.matchAll(pattern)) {
    if (m.index > last) out.push({ type: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else if (SAFE_HREF.test(m[3])) out.push({ type: "link", text: m[2], href: m[3] });
    else out.push({ type: "text", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ type: "text", text: line.slice(last) });
  return out;
}

/** Turns the simple formatting above into blocks. Never produces raw HTML. */
export function parsePolicy(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
      if (list.length) blocks.push({ type: "ul", items: list.map(parseInline) });
      para = [];
      list = [];
    };
    for (const line of lines) {
      if (line.startsWith("## ")) {
        flush();
        blocks.push({ type: "h2", text: line.slice(3).trim() });
      } else if (/^[-*] /.test(line)) {
        if (para.length) {
          blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
          para = [];
        }
        list.push(line.slice(2).trim());
      } else {
        if (list.length) {
          blocks.push({ type: "ul", items: list.map(parseInline) });
          list = [];
        }
        para.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export function formatPolicyDate(iso: string | null): string {
  if (!iso) return "October 2026";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
