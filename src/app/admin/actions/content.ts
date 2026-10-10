"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/auth";
import { fetchSettings } from "@/lib/data/settings";
import type { ActionResult } from "@/lib/types";
import {
  aboutSchema,
  firstIssue,
  homepageSchema,
  IMAGE_BUCKETS,
  orderUpdateSchema,
  storeSettingsSchema,
  testimonialSchema,
} from "@/lib/validation";

async function saveSetting(supabase: SupabaseClient, key: string, value: unknown): Promise<ActionResult> {
  const { error } = await supabase.from("site_settings").upsert({ key, value, is_public: true }, { onConflict: "key" });
  return error ? { ok: false, error: dbError(error) } : { ok: true };
}

/** Deletes stored images that a settings save no longer references. */
async function removeDropped(supabase: SupabaseClient, before: string[], after: string[]) {
  const keep = new Set(after);
  for (const ref of before) {
    if (keep.has(ref)) continue;
    const i = ref.indexOf("/");
    const bucket = ref.slice(0, i);
    if (!(IMAGE_BUCKETS as readonly string[]).includes(bucket)) continue;
    const { error } = await supabase.storage.from(bucket).remove([ref.slice(i + 1)]);
    if (error) console.error("[storage remove]", error.message);
  }
}

export async function saveStoreSettings(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = storeSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    return saveSetting(supabase, "store", parsed.data);
  });
}

export async function saveHomepage(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = homepageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const before = (await fetchSettings(supabase)).homepage.hero.slides.map((s) => s.image_path);
    const result = await saveSetting(supabase, "homepage", parsed.data);
    if (result.ok) await removeDropped(supabase, before, parsed.data.hero.slides.map((s) => s.image_path));
    return result;
  });
}

export async function saveAbout(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = aboutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const before = (await fetchSettings(supabase)).about.founders.map((f) => f.image_path);
    const result = await saveSetting(supabase, "about", parsed.data);
    if (result.ok) await removeDropped(supabase, before, parsed.data.founders.map((f) => f.image_path));
    return result;
  });
}

export async function saveTestimonial(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = testimonialSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, author_location, ...rest } = parsed.data;
    const row = { ...rest, author_location: author_location || null };
    const { error } = id
      ? await supabase.from("testimonials").update(row).eq("id", id)
      : await supabase.from("testimonials").insert(row);
    return error ? { ok: false, error: dbError(error) } : { ok: true };
  });
}

export async function deleteTestimonial(id: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const { error } = await supabase.from("testimonials").delete().eq("id", parsed.data);
    return error ? { ok: false, error: dbError(error) } : { ok: true };
  });
}

/**
 * Status and payment are changed only here, by an administrator. Nothing in
 * the customer flow ever marks an order confirmed or paid.
 */
export async function updateOrder(input: unknown): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const parsed = orderUpdateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, admin_note, ...fields } = parsed.data;
    const { data, error } = await supabase
      .from("orders")
      .update({ ...fields, admin_note: admin_note || null })
      .eq("id", id)
      .select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!data?.length) return { ok: false, error: "Order not found." };
    return { ok: true };
  });
}
