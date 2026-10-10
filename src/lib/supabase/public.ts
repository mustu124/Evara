import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublicKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Cookie-less client for public storefront reads. It carries no session, so
 * Row Level Security only ever exposes published catalog data, and pages that
 * use it can be statically cached.
 */
export function getPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createClient(supabaseUrl, supabasePublicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
