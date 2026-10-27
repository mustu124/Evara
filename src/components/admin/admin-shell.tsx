"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Boxes, ExternalLink, FileText, FolderTree, Home, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingCart, Sparkles, X,
} from "lucide-react";
import { signOut } from "@/app/admin/actions/auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Sparkles },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/homepage", label: "Homepage", icon: Home },
  { href: "/admin/policies", label: "Policies", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_1fr]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ivory px-4 lg:hidden">
        <span className="font-serif text-xl tracking-[0.25em] text-copper-dark">EVARA</span>
        <button type="button" className="flex size-10 items-center justify-center rounded-lg hover:bg-blush/30" aria-expanded={open} aria-controls="admin-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </header>

      <aside id="admin-nav" className={`${open ? "block" : "hidden"} border-b border-line bg-ivory lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r`}>
        <div className="hidden px-6 pb-2 pt-7 lg:block">
          <p className="font-serif text-2xl tracking-[0.28em] text-copper-dark">EVARA</p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-muted">Admin</p>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} aria-current={isActive(href) ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive(href) ? "bg-blush/60 font-medium text-cocoa" : "text-cocoa hover:bg-blush/30"}`}>
                  <Icon aria-hidden className="size-4 text-copper-dark" strokeWidth={1.75} /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <Link href="/" target="_blank" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-cocoa hover:bg-blush/30">
            <ExternalLink aria-hidden className="size-4 text-copper-dark" strokeWidth={1.75} /> View store
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-cocoa hover:bg-blush/30">
              <LogOut aria-hidden className="size-4 text-copper-dark" strokeWidth={1.75} /> Sign out
            </button>
          </form>
          <p className="truncate px-3 pb-1 pt-2 text-xs text-muted" title={email}>{email}</p>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
