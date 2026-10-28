import { z } from "zod";
import { isValidGstin } from "@/lib/gst";

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep",
  "Puducherry",
] as const;

/** "+91 98765 43210", "098765 43210" → "9876543210". Returns null if not a valid Indian mobile. */
export function normalizeIndianMobile(input: string): string | null {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .min(min, `${label} is too short`)
    .max(max, `${label} is too long`);

export const customerSchema = z.object({
  name: text(2, 120, "Name"),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(254)]),
  /** Optional. Checked only when the customer enters one. */
  gstin: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidGstin(v), "Enter a valid 15-character GSTIN, or leave this empty"),
  address_line1: text(3, 200, "Address"),
  address_line2: z.string().trim().max(200, "Address line is too long"),
  city: text(2, 80, "City"),
  state: z.enum(INDIAN_STATES, "Select your state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  note: z.string().trim().max(500, "Note is too long"),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const cartItemSchema = z.object({
  variant_id: z.uuid(),
  /** One list of chosen option-value ids per candle in the pack. */
  units: z.array(z.array(z.uuid()).max(12)).min(1).max(48),
  quantity: z.number().int().min(1).max(50),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const orderRequestSchema = z.object({
  customer: customerSchema,
  items: z.array(cartItemSchema).min(1, "Your cart is empty").max(50),
  /** Honeypot: real customers never fill this. */
  website: z.string().max(0).optional(),
});

/* ───────────── admin ───────────── */

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only")
  .max(120);
const imageRef = z
  .string()
  .regex(/^(product-images|homepage-images|founder-images|collection-images)\/[\w./-]+$/, "Invalid image")
  .nullable();
const money = z.coerce.number<number>().min(0, "Must be 0 or more").max(1_000_000);
const uuidOrNull = z.union([z.uuid(), z.literal(""), z.null()]).transform((v) => v || null);

export const taxonomySchema = z.object({
  id: z.uuid().optional(),
  name: text(1, 120, "Name"),
  slug,
  description: z.string().trim().max(1000),
  parent_id: uuidOrNull.optional(),
  image_path: imageRef,
  sort_order: z.coerce.number<number>().int().min(0).max(100000),
  is_active: z.boolean(),
  is_coming_soon: z.boolean().optional(),
});
export type TaxonomyInput = z.infer<typeof taxonomySchema>;

export const productSchema = z.object({
  id: z.uuid().optional(),
  name: text(1, 160, "Name"),
  slug,
  description: z.string().trim().max(5000),
  category_id: uuidOrNull,
  status: z.enum(["draft", "published", "archived"]),
  is_coming_soon: z.boolean(),
  is_bestseller: z.boolean(),
  on_sale: z.boolean(),
  /** Empty means "use the store default GST rate". */
  gst_rate: z
    .union([z.literal(""), z.null(), z.coerce.number<number>().min(0, "Must be 0 or more").max(40, "Must be 40 or less")])
    .transform((v) => (v === "" || v === null ? null : v)),
  /** One candle with its container, in grams. Shown as "Total Weight" and used for shipping. */
  weight_grams: z
    .number("Enter the total weight in grams")
    .int("Use whole grams")
    .min(1, "Enter the total weight in grams")
    .max(100000, "Must be 100,000 g or less")
    .nullable()
    .refine((v) => v !== null, "Enter the total weight in grams")
    .transform((v) => v as number),
  sort_order: z.coerce.number<number>().int().min(0).max(100000),
  track_inventory: z.boolean(),
  stock_quantity: z.coerce.number<number>().int().min(0).max(1_000_000),
  low_stock_threshold: z.coerce.number<number>().int().min(0).max(1_000_000),
  collection_ids: z.array(z.uuid()),
  specifications: z
    .array(z.object({ label: text(1, 80, "Label"), value: text(1, 300, "Value") }))
    .max(30),
  variants: z
    .array(
      z
        .object({
          id: z.uuid().optional(),
          label: text(1, 80, "Label"),
          pack_quantity: z.coerce.number<number>().int().min(1, "At least 1").max(1000),
          price: money,
          compare_at_price: z
            .union([z.literal(""), z.null(), money])
            .transform((v) => (v === "" || v === null ? null : v)),
          is_available: z.boolean(),
          is_coming_soon: z.boolean(),
        })
        .refine((v) => v.compare_at_price === null || v.compare_at_price >= v.price, {
          message: "Original price must not be lower than the selling price",
          path: ["compare_at_price"],
        }),
    )
    .max(30),
  options: z
    .array(
      z.object({
        id: z.uuid().optional(),
        name: text(1, 60, "Option name"),
        kind: z.enum(["design", "colour", "fragrance", "other"]),
        values: z
          .array(
            z.object({
              id: z.uuid().optional(),
              value: text(1, 80, "Value"),
              is_available: z.boolean(),
              is_coming_soon: z.boolean(),
            }),
          )
          .min(1, "Add at least one value")
          .max(60),
      }),
    )
    .max(8),
});
export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const storeSettingsSchema = z.object({
  whatsapp_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 15), {
      message: "Include the country code, e.g. 919876543210",
    }),
  phone_display: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  instagram_url: z.union([
    z.literal(""),
    z.url("Enter a full URL starting with https://").startsWith("https://", "Must start with https://"),
  ]),
  address: z.string().trim().max(300),
  business_hours: z.string().trim().max(120),
  shipping_rate_intra_per_kg: money,
  shipping_rate_inter_per_kg: money,
  free_shipping_above: z
    .union([z.literal(""), z.null(), money])
    .transform((v) => (v === "" || v === null ? null : v)),
  seller_state: z.enum(INDIAN_STATES, "Select the state the business is registered in"),
  default_gst_rate: z.coerce.number<number>().min(0, "Must be 0 or more").max(40, "Must be 40 or less"),
});

export const homepageSchema = z.object({
  hero: z.object({
    eyebrow: z.string().trim().max(80),
    heading: text(1, 120, "Heading"),
    subheading: z.string().trim().max(300),
    cta_label: text(1, 40, "Button label"),
    cta_href: z.string().trim().regex(/^\/[\w\-/?=&%]*$/, "Use a site path such as /shop"),
    slides: z
      .array(z.object({ image_path: imageRef.unwrap(), alt: z.string().trim().max(160) }))
      .max(8),
  }),
  sections: z.object({
    categories: z.boolean(),
    bestsellers: z.boolean(),
    collections: z.boolean(),
    gallery: z.boolean(),
    founders: z.boolean(),
    testimonials: z.boolean(),
  }),
});

export const aboutSchema = z.object({
  story: z.string().trim().max(10000),
  founders: z
    .array(z.object({ name: z.string().trim().max(80), image_path: imageRef.unwrap() }))
    .max(6),
});

export const testimonialSchema = z.object({
  id: z.uuid().optional(),
  author_name: text(1, 120, "Name"),
  author_location: z.string().trim().max(120),
  quote: text(1, 1000, "Review"),
  rating: z.union([z.literal(""), z.null(), z.coerce.number<number>().int().min(1).max(5)]).transform((v) => v || null),
  is_published: z.boolean(),
  sort_order: z.coerce.number<number>().int().min(0).max(100000),
});

export const orderUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "completed", "cancelled"]),
  payment_status: z.enum(["unpaid", "paid", "refunded"]),
  admin_note: z.string().trim().max(2000),
});

export const inventorySchema = z.object({
  id: z.uuid(),
  track_inventory: z.boolean(),
  stock_quantity: z.coerce.number<number>().int().min(0).max(1_000_000),
  low_stock_threshold: z.coerce.number<number>().int().min(0).max(1_000_000),
  is_coming_soon: z.boolean(),
});

export const IMAGE_BUCKETS = ["product-images", "homepage-images", "founder-images", "collection-images"] as const;
export type ImageBucket = (typeof IMAGE_BUCKETS)[number];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** First error message of a failed zod parse, with its field path. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.filter((p) => typeof p === "string").join(" › ");
  return path ? `${path}: ${issue.message}` : issue.message;
}
