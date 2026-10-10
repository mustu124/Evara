"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import {
  firstIssue,
  IMAGE_BUCKETS,
  IMAGE_TYPES,
  inventorySchema,
  MAX_IMAGE_BYTES,
  productSchema,
  taxonomySchema,
  type ImageBucket,
} from "@/lib/validation";

/* ───────────────────────── images ───────────────────────── */

function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(avif|avis)/.test(ascii(8, 12))) return "image/avif";
  return null;
}

const splitRef = (ref: string) => {
  const i = ref.indexOf("/");
  return { bucket: ref.slice(0, i), path: ref.slice(i + 1) };
};

/** Validates and stores one image under a unique name. Returns "<bucket>/<path>". */
async function storeImage(supabase: SupabaseClient, file: unknown, bucket: ImageBucket, folder: string): Promise<ActionResult<{ ref: string }>> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `"${file.name}" is larger than 4 MB.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type || !IMAGE_TYPES[type]) return { ok: false, error: `"${file.name}" is not a JPEG, PNG, WebP or AVIF image.` };

  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "").replace(/^\/+|\/+$/g, "") || "misc";
  const path = `${safeFolder}/${randomUUID()}.${IMAGE_TYPES[type]}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("[storage upload]", error.message);
    return { ok: false, error: `Could not upload "${file.name}". Check that the storage buckets have been created.` };
  }
  return { ok: true, ref: `${bucket}/${path}` };
}

async function removeImages(supabase: SupabaseClient, refs: (string | null | undefined)[]) {
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref) continue;
    const { bucket, path } = splitRef(ref);
    if (!(IMAGE_BUCKETS as readonly string[]).includes(bucket) || !path) continue;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) console.error("[storage remove]", error.message);
  }
}

const uploadMeta = z.object({ bucket: z.enum(IMAGE_BUCKETS), folder: z.string().max(80) });

/** Generic single-image upload used by category, collection, hero and founder editors. */
export async function uploadImage(formData: FormData): Promise<ActionResult<{ ref: string }>> {
  return adminAction(async ({ supabase }) => {
    const meta = uploadMeta.safeParse({ bucket: formData.get("bucket"), folder: formData.get("folder") ?? "" });
    if (!meta.success) return { ok: false, error: "Invalid upload target." };
    return storeImage(supabase, formData.get("file"), meta.data.bucket, meta.data.folder);
  });
}

/* ───────────────────────── products ───────────────────────── */

export async function saveProduct(input: unknown): Promise<ActionResult<{ id: string; stamp: string }>> {
  return adminAction<{ id: string; stamp: string }>(async ({ supabase }) => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const d = parsed.data;

    const labels = d.variants.map((v) => v.label.toLowerCase());
    if (new Set(labels).size !== labels.length) return { ok: false, error: "Each pack size needs a different label." };
    const optionNames = d.options.map((o) => o.name.toLowerCase());
    if (new Set(optionNames).size !== optionNames.length) return { ok: false, error: "Each option needs a different name." };
    for (const o of d.options) {
      const values = o.values.map((v) => v.value.toLowerCase());
      if (new Set(values).size !== values.length) return { ok: false, error: `"${o.name}" has duplicate values.` };
    }
    if (d.status === "published" && d.variants.length === 0) {
      return { ok: false, error: "Add at least one pack size with a price before publishing." };
    }

    const row = {
      name: d.name,
      slug: d.slug,
      description: d.description,
      category_id: d.category_id,
      status: d.status,
      is_coming_soon: d.is_coming_soon,
      is_bestseller: d.is_bestseller,
      on_sale: d.on_sale,
      gst_rate: d.gst_rate,
      sort_order: d.sort_order,
      track_inventory: d.track_inventory,
      stock_quantity: d.stock_quantity,
      low_stock_threshold: d.low_stock_threshold,
      specifications: d.specifications,
    };

    let id = d.id;
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) return { ok: false, error: dbError(error) };
    } else {
      const { data, error } = await supabase.from("products").insert(row).select("id").single();
      if (error) return { ok: false, error: dbError(error) };
      id = data.id as string;
    }
    const productId = id!;

    // Collections
    {
      const { error: delError } = await supabase.from("product_collections").delete().eq("product_id", productId);
      if (delError) return { ok: false, error: dbError(delError) };
      if (d.collection_ids.length) {
        const { error } = await supabase
          .from("product_collections")
          .insert([...new Set(d.collection_ids)].map((collection_id) => ({ product_id: productId, collection_id })));
        if (error) return { ok: false, error: dbError(error) };
      }
    }

    // Pack sizes. Ids from the form are honoured only if they belong to this product.
    {
      const { data: existing, error: readError } = await supabase.from("product_variants").select("id").eq("product_id", productId);
      if (readError) return { ok: false, error: dbError(readError) };
      const known = new Set((existing ?? []).map((v) => v.id as string));
      const rows = d.variants.map((v, i) => ({
        id: v.id && known.has(v.id) ? v.id : randomUUID(),
        product_id: productId,
        label: v.label,
        pack_quantity: v.pack_quantity,
        price: v.price,
        compare_at_price: v.compare_at_price,
        is_available: v.is_available,
        is_coming_soon: v.is_coming_soon,
        sort_order: i,
      }));
      const keep = new Set(rows.map((r) => r.id));
      const remove = [...known].filter((k) => !keep.has(k));
      if (remove.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", remove);
        if (error) return { ok: false, error: dbError(error) };
      }
      if (rows.length) {
        const { error } = await supabase.from("product_variants").upsert(rows);
        if (error) return { ok: false, error: dbError(error) };
      }
    }

    // Options and their values
    {
      const { data: existing, error: readError } = await supabase
        .from("product_options")
        .select("id, values:product_option_values ( id )")
        .eq("product_id", productId);
      if (readError) return { ok: false, error: dbError(readError) };
      const knownOptions = new Map((existing ?? []).map((o) => [o.id as string, new Set((o.values as { id: string }[]).map((v) => v.id))]));

      const optionRows = d.options.map((o, i) => ({
        id: o.id && knownOptions.has(o.id) ? o.id : randomUUID(),
        product_id: productId,
        name: o.name,
        kind: o.kind,
        sort_order: i,
      }));
      const keepOptions = new Set(optionRows.map((o) => o.id));
      const removeOptions = [...knownOptions.keys()].filter((k) => !keepOptions.has(k));
      if (removeOptions.length) {
        const { error } = await supabase.from("product_options").delete().in("id", removeOptions);
        if (error) return { ok: false, error: dbError(error) };
      }
      if (optionRows.length) {
        const { error } = await supabase.from("product_options").upsert(optionRows);
        if (error) return { ok: false, error: dbError(error) };
      }

      for (const [i, o] of d.options.entries()) {
        const optionId = optionRows[i].id;
        const knownValues = knownOptions.get(optionId) ?? new Set<string>();
        const valueRows = o.values.map((v, j) => ({
          id: v.id && knownValues.has(v.id) ? v.id : randomUUID(),
          option_id: optionId,
          value: v.value,
          is_available: v.is_available,
          is_coming_soon: v.is_coming_soon,
          sort_order: j,
        }));
        const keepValues = new Set(valueRows.map((v) => v.id));
        const removeValues = [...knownValues].filter((k) => !keepValues.has(k));
        if (removeValues.length) {
          const { error } = await supabase.from("product_option_values").delete().in("id", removeValues);
          if (error) return { ok: false, error: dbError(error) };
        }
        const { error } = await supabase.from("product_option_values").upsert(valueRows);
        if (error) return { ok: false, error: dbError(error) };
      }
    }

    // `stamp` lets the editor reload itself from the database after each save.
    return { ok: true, id: productId, stamp: Date.now().toString(36) };
  });
}

const statusInput = z.object({ id: z.uuid(), status: z.enum(["draft", "published", "archived"]) });

export async function setProductStatus(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = statusInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    if (parsed.data.status === "published") {
      const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", parsed.data.id);
      if (!count) return { ok: false, error: "Add at least one pack size with a price before publishing." };
    }
    const { error } = await supabase.from("products").update({ status: parsed.data.status }).eq("id", parsed.data.id);
    return error ? { ok: false, error: dbError(error) } : { ok: true };
  });
}

/**
 * Permanent deletion. Only archived products can be deleted, so it always
 * takes two deliberate steps. Past orders keep their own copy of the item.
 */
export async function deleteProduct(id: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: "Invalid product." };
    const { data: product } = await supabase
      .from("products")
      .select("status, images:product_images ( storage_path )")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!product) return { ok: false, error: "Product not found." };
    if (product.status !== "archived") return { ok: false, error: "Archive the product first, then delete it." };

    const { data: removed, error } = await supabase.from("products").delete().eq("id", parsed.data).select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!removed?.length) return { ok: false, error: "The product could not be deleted." };
    await removeImages(supabase, (product.images as { storage_path: string }[]).map((i) => i.storage_path));
    return { ok: true };
  });
}

const bestsellerInput = z.object({ ids: z.array(z.uuid()).max(200) });

/** Sets exactly which products appear in the homepage Bestsellers section. */
export async function setBestsellers(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = bestsellerInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const { ids } = parsed.data;
    let clear = supabase.from("products").update({ is_bestseller: false }).eq("is_bestseller", true);
    if (ids.length) clear = clear.not("id", "in", `(${ids.join(",")})`);
    const { error: clearError } = await clear;
    if (clearError) return { ok: false, error: dbError(clearError) };
    if (ids.length) {
      const { error } = await supabase.from("products").update({ is_bestseller: true }).in("id", ids);
      if (error) return { ok: false, error: dbError(error) };
    }
    return { ok: true };
  });
}

export async function updateInventory(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = inventorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, ...fields } = parsed.data;
    const { error } = await supabase.from("products").update(fields).eq("id", id);
    return error ? { ok: false, error: dbError(error) } : { ok: true };
  });
}

/* ───────────────────── product images ───────────────────── */

export async function addProductImages(formData: FormData): Promise<ActionResult<{ added: number }>> {
  return adminAction(async ({ supabase }) => {
    const productId = z.uuid().safeParse(formData.get("product_id"));
    if (!productId.success) return { ok: false, error: "Invalid product." };
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, error: "Choose at least one image." };
    if (files.length > 8) return { ok: false, error: "Upload up to 8 images at a time." };

    const { data: product } = await supabase.from("products").select("name").eq("id", productId.data).maybeSingle();
    if (!product) return { ok: false, error: "Product not found." };
    const { data: last } = await supabase
      .from("product_images")
      .select("sort_order")
      .eq("product_id", productId.data)
      .order("sort_order", { ascending: false })
      .limit(1);
    let sort = (last?.[0]?.sort_order ?? -1) + 1;

    let added = 0;
    for (const file of files) {
      const stored = await storeImage(supabase, file, "product-images", `products/${productId.data}`);
      if (!stored.ok) return added ? { ok: false, error: `${added} uploaded. ${stored.error}` } : stored;
      const { error } = await supabase
        .from("product_images")
        .insert({ product_id: productId.data, storage_path: stored.ref, alt: product.name, sort_order: sort++ });
      if (error) {
        await removeImages(supabase, [stored.ref]);
        return { ok: false, error: dbError(error) };
      }
      added++;
    }
    return { ok: true, added };
  });
}

export async function replaceProductImage(formData: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const imageId = z.uuid().safeParse(formData.get("image_id"));
    if (!imageId.success) return { ok: false, error: "Invalid image." };
    const { data: image } = await supabase.from("product_images").select("product_id, storage_path").eq("id", imageId.data).maybeSingle();
    if (!image) return { ok: false, error: "Image not found." };
    const stored = await storeImage(supabase, formData.get("file"), "product-images", `products/${image.product_id}`);
    if (!stored.ok) return stored;
    const { error } = await supabase.from("product_images").update({ storage_path: stored.ref }).eq("id", imageId.data);
    if (error) {
      await removeImages(supabase, [stored.ref]);
      return { ok: false, error: dbError(error) };
    }
    await removeImages(supabase, [image.storage_path]);
    return { ok: true };
  });
}

const imageUpdate = z.object({
  id: z.uuid(),
  alt: z.string().trim().max(200),
  option_value_id: z.union([z.uuid(), z.literal(""), z.null()]).transform((v) => v || null),
  show_in_gallery: z.boolean(),
});

export async function updateProductImage(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = imageUpdate.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, ...fields } = parsed.data;
    const { error } = await supabase.from("product_images").update(fields).eq("id", id);
    return error ? { ok: false, error: dbError(error) } : { ok: true };
  });
}

const reorderInput = z.object({ product_id: z.uuid(), ids: z.array(z.uuid()).min(1).max(100) });

export async function reorderProductImages(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = reorderInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    for (const [i, id] of parsed.data.ids.entries()) {
      const { error } = await supabase.from("product_images").update({ sort_order: i }).eq("id", id).eq("product_id", parsed.data.product_id);
      if (error) return { ok: false, error: dbError(error) };
    }
    return { ok: true };
  });
}

export async function deleteProductImage(id: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: "Invalid image." };
    const { data: image } = await supabase.from("product_images").select("storage_path").eq("id", parsed.data).maybeSingle();
    if (!image) return { ok: true };
    const { error } = await supabase.from("product_images").delete().eq("id", parsed.data);
    if (error) return { ok: false, error: dbError(error) };
    await removeImages(supabase, [image.storage_path]);
    return { ok: true };
  });
}

/* ───────────────── categories & collections ───────────────── */

const taxonomyKind = z.enum(["categories", "collections"]);

export async function saveTaxonomy(kind: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction<{ id: string }>(async ({ supabase }) => {
    const table = taxonomyKind.safeParse(kind);
    const parsed = taxonomySchema.safeParse(input);
    if (!table.success) return { ok: false, error: "Invalid request." };
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, parent_id, is_coming_soon, ...common } = parsed.data;
    if (id && parent_id === id) return { ok: false, error: "A category cannot be its own parent." };

    const row = table.data === "categories" ? { ...common, parent_id: parent_id ?? null, is_coming_soon: Boolean(is_coming_soon) } : common;

    let previousImage: string | null = null;
    if (id) {
      const { data: before } = await supabase.from(table.data).select("image_path").eq("id", id).maybeSingle();
      previousImage = (before?.image_path as string | null) ?? null;
      const { error } = await supabase.from(table.data).update(row).eq("id", id);
      if (error) return { ok: false, error: dbError(error) };
      if (previousImage && previousImage !== row.image_path) await removeImages(supabase, [previousImage]);
      return { ok: true, id };
    }
    const { data, error } = await supabase.from(table.data).insert(row).select("id").single();
    if (error) return { ok: false, error: dbError(error) };
    return { ok: true, id: data.id as string };
  });
}

export async function deleteTaxonomy(kind: unknown, id: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const table = taxonomyKind.safeParse(kind);
    const parsedId = z.uuid().safeParse(id);
    if (!table.success || !parsedId.success) return { ok: false, error: "Invalid request." };

    if (table.data === "categories") {
      const [{ count: products }, { count: children }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", parsedId.data),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", parsedId.data),
      ]);
      if (products) return { ok: false, error: `${products} product(s) use this category. Move them first, or hide the category instead.` };
      if (children) return { ok: false, error: "This category has sub-categories. Move or delete them first." };
    }
    const { data: before } = await supabase.from(table.data).select("image_path").eq("id", parsedId.data).maybeSingle();
    const { error } = await supabase.from(table.data).delete().eq("id", parsedId.data);
    if (error) return { ok: false, error: dbError(error) };
    await removeImages(supabase, [before?.image_path as string | null]);
    return { ok: true };
  });
}
