import { describe, expect, it } from "vitest";
import { formatINR, groupByCandle, productAvailability, slugify, startingPrice } from "@/lib/format";
import { buildInvoice, gstSplit, isValidGstin } from "@/lib/gst";
import { DEFAULT_POLICIES, normalizePolicies, parsePolicy, POLICY_KEYS } from "@/lib/policies";
import { normalizeSettings } from "@/lib/data/settings";
import { chargeableKg, formatWeight, shippingCharge, shippingRate } from "@/lib/shipping";
import { customerSchema, normalizeIndianMobile, orderRequestSchema, productSchema } from "@/lib/validation";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

const customer = {
  name: "Asha Rao",
  phone: "+91 98765 43210",
  email: "",
  gstin: "",
  address_line1: "12 Lake View Road",
  address_line2: "",
  city: "Pune",
  state: "Maharashtra" as const,
  pincode: "411001",
  note: "",
};

describe("formatting", () => {
  it("formats rupees with Indian grouping and no needless decimals", () => {
    expect(formatINR(299)).toBe("₹299");
    expect(formatINR(1080)).toBe("₹1,080");
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(99.5)).toBe("₹99.5");
  });

  it("creates clean slugs", () => {
    expect(slugify("Valentine’s Special")).toBe("valentines-special");
    expect(slugify("  T Light Candles ")).toBe("t-light-candles");
    expect(slugify("Bamboo & White Tea")).toBe("bamboo-white-tea");
  });
});

describe("availability", () => {
  const variant = (over = {}) => ({ id: "v", label: "Single Piece", pack_quantity: 1, price: 150, compare_at_price: 200, is_available: true, is_coming_soon: false, sort_order: 0, ...over });
  const base = { is_coming_soon: false, track_inventory: false, stock_quantity: 0 };

  it("is available when untracked and a variant is orderable", () => {
    expect(productAvailability({ ...base, variants: [variant()] })).toBe("available");
  });
  it("respects the product coming-soon flag", () => {
    expect(productAvailability({ ...base, is_coming_soon: true, variants: [variant()] })).toBe("coming_soon");
  });
  it("is coming soon when every variant is coming soon", () => {
    expect(productAvailability({ ...base, variants: [variant({ is_coming_soon: true })] })).toBe("coming_soon");
  });
  it("is out of stock when tracked stock cannot cover the smallest pack", () => {
    expect(productAvailability({ ...base, track_inventory: true, stock_quantity: 1, variants: [variant({ pack_quantity: 2 })] })).toBe("out_of_stock");
    expect(productAvailability({ ...base, track_inventory: true, stock_quantity: 2, variants: [variant({ pack_quantity: 2 })] })).toBe("available");
  });
  it("picks the lowest orderable price as the starting price", () => {
    const cheapButSoon = variant({ price: 100, is_coming_soon: true });
    expect(startingPrice([variant({ price: 285 }), cheapButSoon, variant({ price: 150 })])?.price).toBe(150);
  });
});

describe("customer validation", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("098765-43210")).toBe("9876543210");
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("12345")).toBeNull();
    expect(normalizeIndianMobile("5876543210")).toBeNull();
  });

  it("accepts a valid customer and rejects bad fields", () => {
    expect(customerSchema.safeParse(customer).success).toBe(true);
    expect(customerSchema.safeParse({ ...customer, pincode: "4110" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...customer, phone: "123" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...customer, state: "Atlantis" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...customer, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects orders that fill the honeypot, have no items, or carry bad quantities", () => {
    const item = { variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", units: [[]], quantity: 1 };
    expect(orderRequestSchema.safeParse({ customer, items: [item] }).success).toBe(true);
    expect(orderRequestSchema.safeParse({ customer, items: [] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...item, quantity: 0 }] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...item, quantity: 1.5 }] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...item, variant_id: "abc" }] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [item], website: "spam" }).success).toBe(false);
  });

  it("strips any price a browser tries to send with a cart item", () => {
    const parsed = orderRequestSchema.parse({
      customer,
      items: [{ variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", units: [[]], quantity: 2, price: 1, unit_price: 1 }],
    });
    expect(parsed.items[0]).toEqual({ variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", units: [[]], quantity: 2 });
  });
});

describe("admin product validation", () => {
  const product = {
    name: "Test Candle", slug: "test-candle", description: "", category_id: "", status: "draft", is_coming_soon: false,
    is_bestseller: false, on_sale: false, gst_rate: "", weight_grams: 250, sort_order: 0, track_inventory: false, stock_quantity: 0, low_stock_threshold: 5,
    collection_ids: [], specifications: [], options: [],
    variants: [{ label: "Single Piece", pack_quantity: 1, price: 299, compare_at_price: 350, is_available: true, is_coming_soon: false }],
  };
  it("accepts a valid product and turns an empty category into null", () => {
    const parsed = productSchema.parse(product);
    expect(parsed.category_id).toBeNull();
    expect(parsed.variants[0].compare_at_price).toBe(350);
  });
  it("rejects an original price below the selling price, bad slugs and negative prices", () => {
    expect(productSchema.safeParse({ ...product, variants: [{ ...product.variants[0], compare_at_price: 100 }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, slug: "Not A Slug" }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, variants: [{ ...product.variants[0], price: -1 }] }).success).toBe(false);
    // Shipping is charged by weight, so every product needs one.
    for (const weight_grams of [null, 0, 2.5]) expect(productSchema.safeParse({ ...product, weight_grams }).success).toBe(false);
  });
});

describe("WhatsApp ordering", () => {
  const order = {
    reference: "EV-261010-AB2CD",
    customer: { ...customer, phone: "+91 9876543210", note: "Gift wrap please" },
    items: [
      { product_name: "Daisy Bowl Jar Candle", variant_label: "Set of 2", pack_quantity: 2, selected_options: [{ unit: 1, name: "Hue", value: "Blush Pink" }, { unit: 1, name: "Scent", value: "Bamboo & White Tea" }, { unit: 2, name: "Hue", value: "Lilac Mist" }, { unit: 2, name: "Scent", value: "Lavender" }], unit_price: 579, quantity: 1, line_total: 579 },
      { product_name: "Fruit Shot Glass Candle", variant_label: "Single Piece", pack_quantity: 1, selected_options: [{ unit: 1, name: "Design", value: "Mango" }], unit_price: 150, quantity: 3, line_total: 450 },
    ],
    subtotal: 1029,
    shipping_amount: 0,
    total: 1029,
  };

  it("includes every required detail in the message", () => {
    const message = buildOrderMessage(order);
    for (const expected of [
      "EV-261010-AB2CD", "Asha Rao", "+91 9876543210", "Daisy Bowl Jar Candle", "Pack size: Set of 2",
      "Candle 1: Hue Blush Pink, Scent Bamboo & White Tea", "Candle 2: Hue Lilac Mist, Scent Lavender", "Design: Mango", "Qty: 3 x ₹150 = ₹450", "Subtotal: ₹1,029", "Total: ₹1,029",
      "12 Lake View Road", "Pune, Maharashtra - 411001", "Gift wrap please",
    ]) {
      expect(message).toContain(expected);
    }
  });

  it("shows the shipping charge as its own line", () => {
    expect(buildOrderMessage(order)).not.toContain("Shipping: ₹");
    const withShipping = buildOrderMessage({ ...order, shipping_amount: 100, total: 1129 });
    expect(withShipping).toContain("Shipping: ₹100");
    expect(withShipping).toContain("Total: ₹1,129");
    expect(withShipping.match(/Shipping: /g)).toHaveLength(1);
  });

  it("includes the GST breakdown and an optional GSTIN", () => {
    const intra = buildOrderMessage({ ...order, customer: { ...order.customer, gstin: "27AAPFU0939F1ZV" }, tax: { intra_state: true, rate: 5, taxable_value: 980, cgst: 24.5, sgst: 24.5, igst: 0 } });
    for (const expected of ["GSTIN: 27AAPFU0939F1ZV", "Taxable value: ₹980", "CGST @ 2.5%: ₹24.5", "SGST @ 2.5%: ₹24.5"]) expect(intra).toContain(expected);
    expect(intra).not.toContain("IGST");
    const inter = buildOrderMessage({ ...order, tax: { intra_state: false, rate: 5, taxable_value: 980, cgst: 0, sgst: 0, igst: 49 } });
    expect(inter).toContain("IGST @ 5%: ₹49");
    expect(inter).not.toContain("CGST");
    expect(inter).not.toContain("GSTIN");
  });

  it("builds a correctly encoded wa.me link", () => {
    const message = buildOrderMessage(order);
    const url = buildWhatsAppUrl("+91 98765-43210", message)!;
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(url).not.toMatch(/[\s&#]Scent/); // ampersands and newlines must be encoded
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(message);
  });

  it("returns null when no usable number is configured", () => {
    expect(buildWhatsAppUrl("")).toBeNull();
    expect(buildWhatsAppUrl("12345")).toBeNull();
  });
});

describe("settings", () => {
  it("falls back to safe defaults and never invents a WhatsApp number", () => {
    const s = normalizeSettings([]);
    expect(s.store.whatsapp_number).toBe("");
    expect([s.store.shipping_rate_intra_per_kg, s.store.shipping_rate_inter_per_kg]).toEqual([0, 0]);
    expect(s.homepage.sections.bestsellers).toBe(true);
    expect(s.homepage.hero.slides).toEqual([]);
  });
  it("normalises stored values", () => {
    const s = normalizeSettings([{ key: "store", value: { whatsapp_number: "+91 98765 43210", shipping_fee: 100, shipping_rate_intra_per_kg: "80", shipping_rate_inter_per_kg: 120 } }]);
    expect(s.store.whatsapp_number).toBe("919876543210");
    expect([s.store.shipping_rate_intra_per_kg, s.store.shipping_rate_inter_per_kg]).toEqual([80, 120]);
    expect("shipping_fee" in s.store).toBe(false);
  });
});

describe("GST on GST-inclusive prices", () => {
  it("matches the brief's intra-state example: ₹150 within Maharashtra", () => {
    expect(gstSplit(150, 5, true)).toEqual({ taxable: 142.86, cgst: 3.57, sgst: 3.57, igst: 0 });
  });
  it("matches the brief's inter-state example: ₹150 to Punjab", () => {
    expect(gstSplit(150, 5, false)).toEqual({ taxable: 142.86, cgst: 0, sgst: 0, igst: 7.14 });
  });
  it("always adds back up to the price, so GST is never charged on top", () => {
    for (const amount of [1, 99.99, 150, 285, 299, 555, 579, 810, 1080, 12345.67]) {
      for (const rate of [0, 5, 12, 18, 28]) {
        for (const intra of [true, false]) {
          const s = gstSplit(amount, rate, intra);
          expect(Number((s.taxable + s.cgst + s.sgst + s.igst).toFixed(2))).toBe(amount);
          expect(s.cgst).toBe(s.sgst);
        }
      }
    }
  });
  it("decides CGST+SGST or IGST from the seller's and the customer's state", () => {
    const amounts = [{ amount: 150, rate: 5 }, { amount: 100, rate: 5 }];
    const home = buildInvoice(amounts, "Maharashtra", "Maharashtra");
    expect(home).toMatchObject({ intraState: true, taxable: 238.1, cgst: 5.95, sgst: 5.95, igst: 0, total: 250, rate: 5 });
    const away = buildInvoice(amounts, "Punjab", "Maharashtra");
    expect(away).toMatchObject({ intraState: false, taxable: 238.1, cgst: 0, sgst: 0, igst: 11.9, total: 250 });
    expect(buildInvoice([{ amount: 150, rate: 5 }, { amount: 150, rate: 12 }], "Goa", "Maharashtra").rate).toBeNull();
  });
  it("validates a GSTIN only by its format and check character", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin(" 27aapfu0939f1zv ")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZX")).toBe(false); // wrong check character
    expect(isValidGstin("99AAPFU0939F1ZV")).toBe(false); // no such state code
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
  it("leaves the GSTIN optional at checkout but rejects a wrong one", () => {
    expect(customerSchema.safeParse({ ...customer, gstin: "" }).success).toBe(true);
    expect(customerSchema.safeParse({ ...customer, gstin: "27AAPFU0939F1ZV" }).success).toBe(true);
    expect(customerSchema.safeParse({ ...customer, gstin: "ABC" }).success).toBe(false);
  });
});

describe("per-candle choices", () => {
  it("groups stored choices by candle and still reads older single-candle orders", () => {
    const set = [{ unit: 1, name: "Hue", value: "A" }, { unit: 2, name: "Hue", value: "B" }, { unit: 1, name: "Scent", value: "X" }, { unit: 2, name: "Scent", value: "Y" }];
    expect(groupByCandle(set, 2).map((c) => c.map((o) => o.value))).toEqual([["A", "X"], ["B", "Y"]]);
    expect(groupByCandle([{ name: "Hue", value: "A" }, { name: "Scent", value: "X" }], 2)).toHaveLength(1);
    expect(groupByCandle([], 1)).toEqual([]);
  });
  it("requires one list of choices per candle in the order request", () => {
    const base = { variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", quantity: 1 };
    const id = "8f3c1e9a-2b4d-4c6e-8f10-123456789abc";
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...base, units: [[id], [id]] }] }).success).toBe(true);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...base, units: [] }] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...base }] }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ customer, items: [{ ...base, units: [["nope"]] }] }).success).toBe(false);
  });
});

describe("editable policy pages", () => {
  it("turns the simple formatting into headings, paragraphs, lists, bold text and safe links", () => {
    const blocks = parsePolicy("Intro line\ncontinues here.\n\n## Heading\n\n- **One:** first\n- Two\nAfter the list with a [link](/contact).\n\n[bad](javascript:alert(1)) stays text");
    expect(blocks.map((b) => b.type)).toEqual(["p", "h2", "ul", "p", "p"]);
    expect(blocks[0]).toEqual({ type: "p", inline: [{ type: "text", text: "Intro line continues here." }] });
    expect(blocks[2]).toEqual({ type: "ul", items: [[{ type: "bold", text: "One:" }, { type: "text", text: " first" }], [{ type: "text", text: "Two" }]] });
    expect(blocks[3]).toEqual({ type: "p", inline: [{ type: "text", text: "After the list with a " }, { type: "link", text: "link", href: "/contact" }, { type: "text", text: "." }] });
    expect(JSON.stringify(blocks[4])).not.toContain("javascript");
  });
  it("falls back to the original wording for anything not yet edited", () => {
    const p = normalizePolicies({ terms: { body: "Custom terms", updated_at: "2026-10-27T10:00:00Z" }, privacy: { body: "   " } });
    expect(p.terms).toEqual({ body: "Custom terms", updated_at: "2026-10-27T10:00:00Z" });
    expect(p.privacy.body).toBe(DEFAULT_POLICIES.privacy);
    expect(p.shipping.updated_at).toBeNull();
    for (const key of POLICY_KEYS) expect(parsePolicy(DEFAULT_POLICIES[key]).length).toBeGreaterThan(5);
  });
});

describe("weight-based shipping", () => {
  it("rounds the weight up to the next whole kg", () => {
    expect([0, 1, 999, 1000, 1001, 3150].map(chargeableKg)).toEqual([0, 1, 1, 1, 2, 4]);
  });
  it("charges the rate for the delivery state per kg", () => {
    const store = { seller_state: "Maharashtra", shipping_rate_intra_per_kg: 80, shipping_rate_inter_per_kg: 120 };
    expect(shippingCharge({ grams: 600, ratePerKg: shippingRate(store, true), subtotal: 299, freeShippingAbove: null })).toBe(80);
    expect(shippingCharge({ grams: 1200, ratePerKg: shippingRate(store, false), subtotal: 579, freeShippingAbove: null })).toBe(240);
  });
  it("charges nothing for an empty order or once free shipping applies", () => {
    expect(shippingCharge({ grams: 600, ratePerKg: 80, subtotal: 0, freeShippingAbove: null })).toBe(0);
    expect(shippingCharge({ grams: 600, ratePerKg: 80, subtotal: 1500, freeShippingAbove: 1000 })).toBe(0);
  });
  it("formats weights for the specifications table", () => {
    expect([formatWeight(250), formatWeight(1000), formatWeight(1250)]).toEqual(["250 g", "1 kg", "1.25 kg"]);
  });
  it("shows the weight charged for in the WhatsApp message", () => {
    const message = buildOrderMessage({
      reference: "EV-1",
      customer: { name: "A", phone: "+91 9000000000", address_line1: "x", city: "Pune", state: "Maharashtra", pincode: "411001" },
      items: [],
      subtotal: 299,
      shipping_amount: 80,
      shipping_weight_kg: 1,
      total: 379,
    });
    expect(message).toContain("Shipping (1 kg): ₹80");
  });
});
