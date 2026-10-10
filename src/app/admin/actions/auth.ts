"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured) return { error: "Supabase is not configured for this deployment." };
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password." };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // Say what Supabase actually refused, so a wrong password is not confused with a setup problem.
    if (error?.code === "invalid_credentials") return { error: "Incorrect email or password." };
    if (error?.code === "email_not_confirmed") return { error: "This email address has not been confirmed yet. Confirm it in Supabase, then try again." };
    if (error?.status === 429) return { error: "Too many attempts. Please wait a minute and try again." };
    console.error("[admin sign-in]", error?.code, error?.message);
    return { error: "Sign-in is not available right now. Please try again shortly." };
  }

  // Only administrators may hold a session in the admin area. This message is
  // shown only after the correct password, so it reveals nothing to strangers.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Your password is correct, but this account has not been given admin access. Run: npm run db:admin -- " + parsed.data.email };
  }
  redirect("/admin");
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
