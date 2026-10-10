import type { Metadata } from "next";
import Link from "next/link";
import { ArchOrnament } from "@/components/icons";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <ArchOrnament className="w-20 text-blush" />
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-3 text-4xl">This page has melted away</h1>
      <p className="mt-3 max-w-sm text-muted">The page you are looking for does not exist or has been moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/shop" className="btn-outline">Browse the shop</Link>
      </div>
    </main>
  );
}
