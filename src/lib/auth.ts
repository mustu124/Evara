import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export type AdminContext = { supabase: SupabaseClient; user: User };

/**
 * Resolves the signed-in administrator, or null. The session is verified with
 * Supabase Auth (getUser) and the role is read from the database — nothing
 * supplied by the browser is trusted.
 */
export async function getAdmin(): Promise<AdminContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { supabase, user };
}

/** For admin pages and layouts. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * Wraps every privileged server action: re-checks the administrator on the
 * server, runs the mutation under that user's RLS, and refreshes the public
 * site so changes appear immediately.
 */
export async function adminAction<T extends object = object>(
  run: (ctx: AdminContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Your session has expired. Please sign in again." };
  try {
    const result = await run(admin);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("[admin action]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Readable message for common database errors. */
export function dbError(error: { code?: string; message: string }, fallback = "Could not save your changes."): string {
  if (error.code === "23505") return "That name or URL slug is already in use. Please choose another.";
  if (error.code === "23503") return "This item is still referenced elsewhere and cannot be changed that way.";
  if (error.code === "23514") return "One of the values is outside the allowed range.";
  if (error.code === "42501") return "You do not have permission to do that.";
  console.error("[db]", error.code, error.message);
  return fallback;
}
