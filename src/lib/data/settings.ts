import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND } from "@/lib/env";
import { getPublicClient } from "@/lib/supabase/public";
import type { AboutSettings, HomepageSettings, SiteSettings, StoreSettings } from "@/lib/types";

export const DEFAULT_STORE: StoreSettings = {
  whatsapp_number: "",
  phone_display: "",
  email: "",
  instagram_url: "",
  address: "",
  business_hours: "",
  shipping_fee: 0,
  free_shipping_above: null,
};

export const DEFAULT_HOMEPAGE: HomepageSettings = {
  hero: {
    eyebrow: "Handcrafted artisan candles",
    heading: BRAND.tagline,
    subheading:
      "Candles handcrafted in wax with artistry, fragrance and understated elegance — made to make a space feel a little more special.",
    cta_label: "Shop Now",
    cta_href: "/shop",
    slides: [],
  },
  sections: {
    categories: true,
    bestsellers: true,
    collections: true,
    gallery: true,
    founders: true,
    testimonials: true,
  },
};

export const DEFAULT_ABOUT: AboutSettings = { story: "", founders: [] };

type Row = { key: string; value: unknown };

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Merge stored settings over defaults so missing keys never break the UI. */
export function normalizeSettings(rows: Row[]): SiteSettings {
  const by = new Map(rows.map((r) => [r.key, obj(r.value)]));
  const store = { ...DEFAULT_STORE, ...by.get("store") } as StoreSettings;
  store.whatsapp_number = String(store.whatsapp_number ?? "").replace(/\D/g, "");
  store.shipping_fee = Math.max(0, Number(store.shipping_fee) || 0);
  store.free_shipping_above =
    store.free_shipping_above === null || store.free_shipping_above === undefined
      ? null
      : Number(store.free_shipping_above);

  const hp = by.get("homepage") ?? {};
  const hero = { ...DEFAULT_HOMEPAGE.hero, ...obj(hp.hero) } as HomepageSettings["hero"];
  hero.slides = Array.isArray(hero.slides) ? hero.slides.filter((s) => s?.image_path) : [];
  const homepage: HomepageSettings = {
    hero,
    sections: { ...DEFAULT_HOMEPAGE.sections, ...obj(hp.sections) } as HomepageSettings["sections"],
  };

  const ab = { ...DEFAULT_ABOUT, ...by.get("about") } as AboutSettings;
  const about: AboutSettings = {
    story: String(ab.story ?? ""),
    founders: Array.isArray(ab.founders) ? ab.founders.filter((f) => f?.image_path) : [],
  };

  return { store, homepage, about };
}

export async function fetchSettings(client: SupabaseClient | null): Promise<SiteSettings> {
  if (!client) return normalizeSettings([]);
  const { data, error } = await client.from("site_settings").select("key, value");
  if (error && error.code !== "PGRST205") console.error("[settings]", error.message);
  return normalizeSettings((data as Row[] | null) ?? []);
}

/** Public settings, de-duplicated per request. */
export const getSettings = cache(() => fetchSettings(getPublicClient()));

/** WhatsApp number from admin settings, falling back to server configuration. */
export function resolveWhatsAppNumber(store: StoreSettings): string {
  return store.whatsapp_number || (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
}

export type BackendStatus = "ok" | "unconfigured" | "schema_missing" | "unreachable";

/**
 * Whether the storefront is really connected to a usable database. Used to
 * tell visitors (and the developer) the truth instead of showing an empty shop.
 */
export const getBackendStatus = cache(async (): Promise<BackendStatus> => {
  const client = getPublicClient();
  if (!client) return "unconfigured";
  try {
    const { error } = await client.from("site_settings").select("key").limit(1);
    if (!error) return "ok";
    // PGRST205 / 42P01: the table does not exist, i.e. the migrations have not been run.
    return error.code === "PGRST205" || error.code === "42P01" ? "schema_missing" : "unreachable";
  } catch {
    return "unreachable";
  }
});
