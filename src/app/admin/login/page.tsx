import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Image src="/brand/logo-mark.png" alt="Evara" width={710} height={505} priority className="mx-auto h-24 w-auto" />
        <div className="mt-8 rounded-xl border border-line bg-ivory p-7 shadow-soft">
          <h1 className="font-sans text-lg font-semibold text-copper-dark">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">For Evara Studios administrators only.</p>
          {isSupabaseConfigured ? (
            <LoginForm />
          ) : (
            <p role="alert" className="mt-5 rounded-lg border border-blush bg-blush/40 px-3 py-2 text-sm font-medium text-cocoa">
              Supabase is not configured. Add the environment variables described in the README, then reload.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-copper-dark underline underline-offset-4">Back to the store</Link>
        </p>
      </div>
    </main>
  );
}
