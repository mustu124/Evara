/** Public configuration. Safe to import from client and server code. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Publishable key on new Supabase projects, or the legacy anon key. */
export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const BRAND = {
  name: "Evara Studios",
  tagline: "Light that lingers within.",
  description:
    "Evara Studios — artisan candles handcrafted with artistry, fragrance and understated elegance.",
} as const;
