import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Privileged client (bypasses RLS). Server-only: used solely to create orders
 * through the create_order() database function. Returns null when the secret
 * key has not been configured.
 */
export function getServiceClient(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secret) return null;
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
