// Shared setup for the server-side maintenance scripts.
// Run them through npm (`npm run db:storage`, `db:seed`, `db:admin`) so that
// .env.local is loaded. These scripts use the SECRET key and must never run
// in a browser or be bundled into the app.
import { createClient } from "@supabase/supabase-js";

export const BUCKETS = ["product-images", "homepage-images", "founder-images", "collection-images"];

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!secret) missing.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  if (missing.length) {
    fail(`Missing environment variable(s): ${missing.join(", ")}.\nCopy .env.example to .env.local and fill in your Supabase project values.`);
  }
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export const ok = (message) => console.log(`✔ ${message}`);
export const info = (message) => console.log(`  ${message}`);
