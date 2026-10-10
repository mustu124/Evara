import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Collection, ProductImage, ProductOption } from "@/lib/types";
import type { ProductInput } from "@/lib/validation";

/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows */

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** All categories and collections, including hidden ones (admin RLS). */
export async function getAdminTaxonomy(supabase: SupabaseClient) {
  const [categories, collections] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("collections").select("*").order("sort_order").order("name"),
  ]);
  return {
    categories: (categories.data ?? []) as Category[],
    collections: (collections.data ?? []) as Collection[],
    error: categories.error?.message ?? collections.error?.message ?? null,
  };
}

export type AdminProduct = { form: ProductInput; name: string; slug: string; status: string; images: ProductImage[]; options: ProductOption[] };

export async function getAdminProduct(supabase: SupabaseClient, id: string): Promise<AdminProduct | null> {
  const { data } = await supabase
    .from("products")
    .select(
      `*, variants:product_variants ( * ), images:product_images ( * ),
       options:product_options ( *, values:product_option_values ( * ) ),
       product_collections ( collection_id )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const p = data as any;
  const options: ProductOption[] = [...(p.options ?? [])]
    .sort(bySort)
    .map((o: any) => ({ ...o, values: [...(o.values ?? [])].sort(bySort) }));

  return {
    name: p.name,
    slug: p.slug,
    status: p.status,
    images: [...(p.images ?? [])].sort(bySort),
    options,
    form: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      category_id: p.category_id ?? "",
      status: p.status,
      is_coming_soon: p.is_coming_soon,
      is_bestseller: p.is_bestseller,
      on_sale: Boolean(p.on_sale),
      gst_rate: p.gst_rate === null || p.gst_rate === undefined ? null : Number(p.gst_rate),
      sort_order: p.sort_order,
      track_inventory: p.track_inventory,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      collection_ids: (p.product_collections ?? []).map((c: any) => c.collection_id),
      specifications: Array.isArray(p.specifications) ? p.specifications : [],
      variants: [...(p.variants ?? [])].sort(bySort).map((v: any) => ({
        id: v.id,
        label: v.label,
        pack_quantity: v.pack_quantity,
        price: Number(v.price),
        compare_at_price: v.compare_at_price === null ? null : Number(v.compare_at_price),
        is_available: v.is_available,
        is_coming_soon: v.is_coming_soon,
      })),
      options: options.map((o) => ({
        id: o.id,
        name: o.name,
        kind: o.kind,
        values: o.values.map((v) => ({ id: v.id, value: v.value, is_available: v.is_available, is_coming_soon: v.is_coming_soon })),
      })),
    },
  };
}

export const EMPTY_PRODUCT: ProductInput = {
  name: "",
  slug: "",
  description: "",
  category_id: "",
  status: "draft",
  is_coming_soon: false,
  is_bestseller: false,
  on_sale: false,
  gst_rate: null,
  sort_order: 0,
  track_inventory: false,
  stock_quantity: 0,
  low_stock_threshold: 5,
  collection_ids: [],
  specifications: [],
  variants: [{ label: "Single Piece", pack_quantity: 1, price: 0, compare_at_price: null, is_available: true, is_coming_soon: false }],
  options: [],
};
