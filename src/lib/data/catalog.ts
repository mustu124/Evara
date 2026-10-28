import { cache } from "react";
import { productAvailability, startingPrice } from "@/lib/format";
import { getPublicClient } from "@/lib/supabase/public";
import type { AvailabilityKey, SortKey } from "@/lib/data/catalog-options";
import type {
  Category,
  Collection,
  ProductDetail,
  ProductImage,
  ProductOption,
  ProductSummary,
  Testimonial,
  Variant,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows are mapped to typed shapes below */

const SUMMARY_SELECT = `
  id, name, slug, is_coming_soon, is_bestseller, on_sale, track_inventory, stock_quantity, sort_order, created_at,
  category:categories ( id, name, slug ),
  variants:product_variants ( id, label, pack_quantity, price, compare_at_price, is_available, is_coming_soon, sort_order ),
  images:product_images ( storage_path, alt, sort_order )`;

// Until migrations 0003 and 0004 have been applied the products table has no
// on_sale / gst_rate / weight_grams columns. Reading still works without them
// (defaults are used), and the check stops as soon as the columns are seen once.
let hasSaleAndTaxColumns = false;
async function modern(db: NonNullable<ReturnType<typeof getPublicClient>>): Promise<boolean> {
  if (hasSaleAndTaxColumns) return true;
  const { error } = await db.from("products").select("on_sale, weight_grams").limit(1);
  hasSaleAndTaxColumns = !error;
  return hasSaleAndTaxColumns;
}
const legacy = (select: string) => select.replace(", on_sale, gst_rate, weight_grams", "").replace(", on_sale", "");

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

const mapVariant = (v: any): Variant => ({
  ...v,
  price: Number(v.price),
  compare_at_price: v.compare_at_price === null ? null : Number(v.compare_at_price),
});

function mapSummary(row: any): ProductSummary {
  return {
    ...row,
    on_sale: Boolean(row.on_sale),
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : (row.category ?? null),
    variants: (row.variants ?? []).map(mapVariant).sort(bySort),
    images: [...(row.images ?? [])].sort(bySort),
  };
}

function logError(scope: string, error: { message: string; code?: string } | null) {
  // A missing schema is reported once to visitors by <SetupNotice>; no need to log it per query.
  if (error && error.code !== "PGRST205") console.error(`[catalog:${scope}]`, error.message);
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("categories")
    .select("id, parent_id, name, slug, description, image_path, sort_order, is_active, is_coming_soon")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  logError("categories", error);
  return (data as Category[] | null) ?? [];
});

export const getCollections = cache(async (): Promise<Collection[]> => {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("collections")
    .select("id, name, slug, description, image_path, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  logError("collections", error);
  return (data as Collection[] | null) ?? [];
});

/** A category together with all of its descendants. */
export function categoryFamily(categories: Category[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const c of categories) if (c.parent_id === ids[i] && !ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}

export type ProductQuery = {
  q?: string;
  categorySlug?: string;
  collectionSlug?: string;
  sort?: SortKey;
  availability?: AvailabilityKey;
  page?: number;
  pageSize?: number;
};

export type ProductPage = { items: ProductSummary[]; total: number; page: number; pageCount: number };

export const PAGE_SIZE = 12;

/**
 * Filtering happens in the database. Sorting by price and availability depend
 * on variant data, so they and pagination are applied to the (small, capped)
 * filtered set in memory.
 */
export async function getProducts(query: ProductQuery = {}): Promise<ProductPage> {
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const empty: ProductPage = { items: [], total: 0, page: 1, pageCount: 1 };
  const db = getPublicClient();
  if (!db) return empty;

  let select = (await modern(db)) ? SUMMARY_SELECT : legacy(SUMMARY_SELECT);
  let collectionId: string | undefined;
  if (query.collectionSlug) {
    collectionId = (await getCollections()).find((c) => c.slug === query.collectionSlug)?.id;
    if (!collectionId) return empty;
    select += ", product_collections!inner ( collection_id )";
  }

  let request = db.from("products").select(select).eq("status", "published").limit(500);

  if (query.categorySlug) {
    const categories = await getCategories();
    const root = categories.find((c) => c.slug === query.categorySlug);
    if (!root) return empty;
    request = request.in("category_id", categoryFamily(categories, root.id));
  }
  if (collectionId) request = request.eq("product_collections.collection_id", collectionId);
  const term = (query.q ?? "").replace(/[^\p{L}\p{N}\s&'-]/gu, " ").trim().slice(0, 80);
  if (term) {
    const like = `%${term.replace(/\s+/g, "%")}%`;
    request = request.or(`name.ilike.${like},description.ilike.${like}`);
  }

  const { data, error } = await request;
  logError("products", error);
  let items = ((data as any[] | null) ?? []).map(mapSummary);

  if (query.availability === "available") {
    items = items.filter((p) => productAvailability(p) === "available");
  } else if (query.availability === "coming-soon") {
    items = items.filter((p) => productAvailability(p) === "coming_soon");
  }

  const price = (p: ProductSummary) => startingPrice(p.variants)?.price ?? Number.MAX_SAFE_INTEGER;
  const sorters: Record<SortKey, (a: ProductSummary, b: ProductSummary) => number> = {
    featured: (a, b) =>
      Number(b.is_bestseller) - Number(a.is_bestseller) || a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    "price-asc": (a, b) => price(a) - price(b),
    "price-desc": (a, b) => price(b) - price(a),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  items.sort(sorters[query.sort ?? "featured"] ?? sorters.featured);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageCount };
}

export async function getBestsellers(limit = 8): Promise<ProductSummary[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("products")
    .select((await modern(db)) ? SUMMARY_SELECT : legacy(SUMMARY_SELECT))
    .eq("status", "published")
    .eq("is_bestseller", true)
    .order("sort_order")
    .limit(limit);
  logError("bestsellers", error);
  return ((data as any[] | null) ?? []).map(mapSummary);
}

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  const db = getPublicClient();
  if (!db) return null;
  const detailSelect = `id, name, slug, description, status, is_coming_soon, is_bestseller, on_sale, gst_rate, weight_grams, specifications,
       track_inventory, stock_quantity, low_stock_threshold, sort_order, created_at,
       category:categories ( id, name, slug ),
       variants:product_variants ( id, label, pack_quantity, price, compare_at_price, is_available, is_coming_soon, sort_order ),
       images:product_images ( id, storage_path, alt, option_value_id, show_in_gallery, sort_order ),
       options:product_options ( id, name, kind, sort_order,
         values:product_option_values ( id, value, is_available, is_coming_soon, sort_order ) ),
       product_collections ( collections ( id, name, slug ) )`;
  const { data, error } = await db
    .from("products")
    .select((await modern(db)) ? detailSelect : legacy(detailSelect))
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  logError("product", error);
  if (!data) return null;
  const row = data as any;
  const { product_collections, ...rest } = row;
  return {
    ...rest,
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : (row.category ?? null),
    on_sale: Boolean(row.on_sale),
    gst_rate: row.gst_rate === null || row.gst_rate === undefined ? null : Number(row.gst_rate),
    weight_grams: row.weight_grams === null || row.weight_grams === undefined ? null : Number(row.weight_grams),
    specifications: Array.isArray(row.specifications) ? row.specifications : [],
    variants: (row.variants ?? []).map(mapVariant).sort(bySort),
    images: ([...(row.images ?? [])] as ProductImage[]).sort(bySort),
    options: ([...(row.options ?? [])] as ProductOption[])
      .map((o) => ({ ...o, values: [...(o.values ?? [])].sort(bySort) }))
      .sort(bySort),
    collections: (product_collections ?? []).map((pc: any) => pc.collections).filter(Boolean),
  };
});

export async function getRelatedProducts(product: ProductDetail, limit = 4): Promise<ProductSummary[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("products")
    .select((await modern(db)) ? SUMMARY_SELECT : legacy(SUMMARY_SELECT))
    .eq("status", "published")
    .neq("id", product.id)
    .order("sort_order")
    .limit(24);
  logError("related", error);
  const all = ((data as any[] | null) ?? []).map(mapSummary);
  const sameCategory = all.filter((p) => p.category?.id && p.category.id === product.category?.id);
  const others = all.filter((p) => !sameCategory.includes(p));
  return [...sameCategory, ...others].slice(0, limit);
}

export type GalleryImage = { id: string; storage_path: string; alt: string; product: { name: string; slug: string } };

export async function getGalleryImages(limit = 8): Promise<GalleryImage[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("product_images")
    .select("id, storage_path, alt, sort_order, product:products!inner ( name, slug, status, sort_order )")
    .eq("show_in_gallery", true)
    .eq("product.status", "published")
    .limit(60);
  logError("gallery", error);
  return ((data as any[] | null) ?? [])
    .map((r) => ({ ...r, product: Array.isArray(r.product) ? r.product[0] : r.product }))
    .filter((r) => r.product)
    .sort((a, b) => a.product.sort_order - b.product.sort_order || a.sort_order - b.sort_order)
    .slice(0, limit);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("testimonials")
    .select("id, author_name, author_location, quote, rating, is_published, sort_order")
    .eq("is_published", true)
    .order("sort_order")
    .limit(12);
  logError("testimonials", error);
  return (data as Testimonial[] | null) ?? [];
}

export async function getAllProductSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data } = await db.from("products").select("slug, updated_at").eq("status", "published").limit(1000);
  return (data as { slug: string; updated_at: string }[] | null) ?? [];
}
