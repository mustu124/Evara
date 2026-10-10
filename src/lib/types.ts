export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  is_coming_soon: boolean;
};

export type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProductStatus = "draft" | "published" | "archived";
export type OptionKind = "design" | "colour" | "fragrance" | "other";

export type Variant = {
  id: string;
  label: string;
  pack_quantity: number;
  price: number;
  compare_at_price: number | null;
  sku?: string | null;
  is_available: boolean;
  is_coming_soon: boolean;
  sort_order: number;
};

export type OptionValue = {
  id: string;
  value: string;
  is_available: boolean;
  is_coming_soon: boolean;
  sort_order: number;
};

export type ProductOption = {
  id: string;
  name: string;
  kind: OptionKind;
  sort_order: number;
  values: OptionValue[];
};

export type ProductImage = {
  id: string;
  storage_path: string;
  alt: string;
  option_value_id: string | null;
  show_in_gallery: boolean;
  sort_order: number;
};

export type Specification = { label: string; value: string };

export type ProductSummary = {
  id: string;
  name: string;
  slug: string;
  is_coming_soon: boolean;
  is_bestseller: boolean;
  on_sale: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  sort_order: number;
  created_at: string;
  category: Pick<Category, "id" | "name" | "slug"> | null;
  variants: Variant[];
  images: Pick<ProductImage, "storage_path" | "alt" | "sort_order">[];
};

export type ProductDetail = Omit<ProductSummary, "images"> & {
  description: string;
  status: ProductStatus;
  low_stock_threshold: number;
  gst_rate: number | null;
  specifications: Specification[];
  options: ProductOption[];
  images: ProductImage[];
  collections: Pick<Collection, "id" | "name" | "slug">[];
};

export type Testimonial = {
  id: string;
  author_name: string;
  author_location: string | null;
  quote: string;
  rating: number | null;
  is_published: boolean;
  sort_order: number;
};

export type StoreSettings = {
  /** Digits only, with country code. Empty until an administrator sets it. */
  whatsapp_number: string;
  phone_display: string;
  email: string;
  instagram_url: string;
  address: string;
  business_hours: string;
  /** Flat, GST-inclusive charge added once per order. */
  shipping_fee: number;
  free_shipping_above: number | null;
  /** State the business is registered in; decides CGST+SGST versus IGST. */
  seller_state: string;
  /** GST % included in prices, unless a product sets its own rate. */
  default_gst_rate: number;
};

export type HomepageSettings = {
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    cta_label: string;
    cta_href: string;
    slides: { image_path: string; alt: string }[];
  };
  sections: {
    categories: boolean;
    bestsellers: boolean;
    collections: boolean;
    gallery: boolean;
    founders: boolean;
    testimonials: boolean;
  };
};

export type AboutSettings = {
  /** Paragraphs separated by blank lines. */
  story: string;
  founders: { name: string; image_path: string }[];
};

export type SiteSettings = { store: StoreSettings; homepage: HomepageSettings; about: AboutSettings };

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

/** One choice for one candle. `unit` is the candle number within a pack (absent on older orders). */
export type SelectedOption = { unit?: number; name: string; value: string };

export type OrderItem = {
  id?: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string;
  pack_quantity: number;
  selected_options: SelectedOption[];
  unit_price: number;
  compare_at_price: number | null;
  quantity: number;
  line_total: number;
  image_path: string | null;
  gst_rate?: number;
  taxable_value?: number;
  tax_amount?: number;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_gstin?: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  customer_note: string | null;
  admin_note: string | null;
  subtotal: number;
  shipping_amount: number;
  total: number;
  /** GST breakdown; tax_type is null on orders placed before GST was recorded. */
  seller_state?: string | null;
  tax_type?: "intra_state" | "inter_state" | null;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  shipping_gst_rate?: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
};

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
