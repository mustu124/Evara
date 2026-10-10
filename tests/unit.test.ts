import { describe, expect, it } from "vitest";
import { formatINR, productAvailability, slugify, startingPrice } from "@/lib/format";
import { normalizeSettings } from "@/lib/data/settings";
import { customerSchema, normalizeIndianMobile, orderRequestSchema, productSchema } from "@/lib/validation";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

const customer = {
  name: "Asha Rao",
  phone: "+91 98765 43210",
  email: "",
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
    const item = { variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", option_value_ids: [], quantity: 1 };
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
      items: [{ variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", option_value_ids: [], quantity: 2, price: 1, unit_price: 1 }],
    });
    expect(parsed.items[0]).toEqual({ variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", option_value_ids: [], quantity: 2 });
  });
});

describe("admin product validation", () => {
  const product = {
    name: "Test Candle", slug: "test-candle", description: "", category_id: "", status: "draft", is_coming_soon: false,
    is_bestseller: false, sort_order: 0, track_inventory: false, stock_quantity: 0, low_stock_threshold: 5,
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
  });
});

describe("WhatsApp ordering", () => {
  const order = {
    reference: "EV-261010-AB2CD",
    customer: { ...customer, phone: "+91 9876543210", note: "Gift wrap please" },
    items: [
      { product_name: "Daisy Bowl Jar Candle", variant_label: "Set of 2", selected_options: [{ name: "Hue", value: "Blush Pink" }, { name: "Scent", value: "Bamboo & White Tea" }], unit_price: 579, quantity: 1, line_total: 579 },
      { product_name: "Fruit Shot Glass Candle", variant_label: "Single Piece", selected_options: [{ name: "Design", value: "Mango" }], unit_price: 150, quantity: 3, line_total: 450 },
    ],
    subtotal: 1029,
    shipping_amount: 0,
    total: 1029,
  };

  it("includes every required detail in the message", () => {
    const message = buildOrderMessage(order);
    for (const expected of [
      "EV-261010-AB2CD", "Asha Rao", "+91 9876543210", "Daisy Bowl Jar Candle", "Pack size: Set of 2", "Hue: Blush Pink",
      "Scent: Bamboo & White Tea", "Design: Mango", "Qty: 3 x ₹150 = ₹450", "Subtotal: ₹1,029", "Total: ₹1,029",
      "12 Lake View Road", "Pune, Maharashtra - 411001", "Gift wrap please",
    ]) {
      expect(message).toContain(expected);
    }
  });

  it("shows a shipping line only when shipping is charged", () => {
    expect(buildOrderMessage(order)).not.toContain("Shipping: ₹");
    expect(buildOrderMessage({ ...order, shipping_amount: 80, total: 1109 })).toContain("Shipping: ₹80");
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
    expect(s.store.shipping_fee).toBe(0);
    expect(s.homepage.sections.bestsellers).toBe(true);
    expect(s.homepage.hero.slides).toEqual([]);
  });
  it("normalises stored values", () => {
    const s = normalizeSettings([{ key: "store", value: { whatsapp_number: "+91 98765 43210", shipping_fee: "80" } }]);
    expect(s.store.whatsapp_number).toBe("919876543210");
    expect(s.store.shipping_fee).toBe(80);
  });
});
