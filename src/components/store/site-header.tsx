"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { cartCount, useCart } from "@/lib/cart";
import type { Category, Collection } from "@/lib/types";

type Props = { categories: Category[]; collections: Collection[] };

const linkClass = (active: boolean) =>
  `border-b-2 py-1 text-[0.95rem] font-medium transition-colors hover:text-copper ${active ? "border-copper text-copper" : "border-transparent text-cocoa"}`;

export function SiteHeader({ categories, collections }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const count = cartCount(useCart());

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const roots = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => {
    setOpen(false);
    setSearching(false);
  };

  const comingSoon = <span className="ml-2 text-xs text-muted">(soon)</span>;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-ivory focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="container-x grid h-[4.5rem] grid-cols-[auto_1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label="Evara Studios — home" className="flex items-center" onClick={close}>
          <Image src="/brand/logo-mark.png" alt="Evara" width={710} height={505} priority className="h-14 w-auto" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-9 lg:flex">
          <Link href="/" className={linkClass(isActive("/"))} aria-current={pathname === "/" ? "page" : undefined}>
            Home
          </Link>

          <div className="group relative">
            <Link href="/shop" className={`${linkClass(isActive("/shop") || isActive("/categories"))} inline-flex items-center gap-1`}>
              Shop <ChevronDown aria-hidden className="size-3.5" />
            </Link>
            {roots.length > 0 && (
              <div className="invisible absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-5 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="card grid grid-cols-2 gap-x-8 gap-y-1 bg-ivory p-6 shadow-lift">
                  {roots.map((root) => (
                    <div key={root.id} className="break-inside-avoid py-1">
                      <Link href={`/categories/${root.slug}`} className="text-[0.95rem] text-cocoa hover:text-copper">
                        {root.name}
                        {root.is_coming_soon && comingSoon}
                      </Link>
                      {childrenOf(root.id).length > 0 && (
                        <ul className="mb-2 mt-1.5 space-y-1 border-l border-line pl-3">
                          {childrenOf(root.id).map((c) => (
                            <li key={c.id}>
                              <Link href={`/categories/${c.slug}`} className="text-sm text-muted hover:text-copper">
                                {c.name}
                                {c.is_coming_soon && comingSoon}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="group relative">
            <Link href="/collections" className={`${linkClass(isActive("/collections"))} inline-flex items-center gap-1`}>
              Collections <ChevronDown aria-hidden className="size-3.5" />
            </Link>
            {collections.length > 0 && (
              <div className="invisible absolute left-1/2 top-full w-60 -translate-x-1/2 pt-5 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <ul className="card space-y-2 bg-ivory p-6 shadow-lift">
                  {collections.map((c) => (
                    <li key={c.id}>
                      <Link href={`/collections/${c.slug}`} className="text-[0.95rem] text-cocoa hover:text-copper">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Link href="/about" className={linkClass(isActive("/about"))}>About</Link>
          <Link href="/contact" className={linkClass(isActive("/contact"))}>Contact</Link>
        </nav>

        <div className="col-start-3 flex items-center justify-end gap-1">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-cocoa hover:bg-blush hover:text-copper"
            aria-expanded={searching}
            aria-controls="site-search"
            aria-label={searching ? "Close search" : "Search products"}
            onClick={() => {
              setOpen(false);
              setSearching((v) => !v);
            }}
          >
            {searching ? <X aria-hidden className="size-5" strokeWidth={1.5} /> : <Search aria-hidden className="size-5" strokeWidth={1.5} />}
          </button>
          <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`} className="relative flex size-11 items-center justify-center rounded-full text-cocoa hover:bg-blush hover:text-copper">
            <ShoppingBag aria-hidden className="size-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-copper px-1 text-[0.68rem] font-medium leading-5 text-ivory">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          <button type="button" className="flex size-11 items-center justify-center rounded-full text-cocoa hover:bg-blush lg:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => { setSearching(false); setOpen((v) => !v); }}>
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>

      {searching && (
        // A plain GET form: results open on the shop page, and it works without JavaScript too.
        <form id="site-search" action="/shop" method="get" role="search" onSubmit={(e) => {
            // Navigate in-app; closing the bar first would cancel a native submit.
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            if (!q) return;
            setSearching(false);
            router.push(`/shop?q=${encodeURIComponent(q)}`);
          }}
          className="border-t border-line bg-ivory"
        >
          <div className="container-x flex items-center gap-3 py-3">
            <label htmlFor="site-search-input" className="sr-only">Search products</label>
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="site-search-input" name="q" type="search" required maxLength={80} autoFocus placeholder="Search candles" className="input !rounded-full !pl-11" />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </div>
        </form>
      )}

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-full h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-line bg-ivory px-5 pb-12 pt-4 lg:hidden">
          <ul className="divide-y divide-line">
            <li><Link href="/" onClick={close} className="block py-4 font-serif text-2xl text-cocoa">Home</Link></li>
            <li>
              <Link href="/shop" onClick={close} className="block py-4 font-serif text-2xl text-cocoa">Shop all</Link>
            </li>
            {roots.length > 0 && (
              <li>
                <details className="group py-4">
                  <summary className="flex list-none items-center justify-between font-serif text-2xl text-cocoa [&::-webkit-details-marker]:hidden">
                    Categories <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {roots.map((root) => (
                      <li key={root.id}>
                        <Link href={`/categories/${root.slug}`} onClick={close} className="text-cocoa">
                          {root.name}
                          {root.is_coming_soon && comingSoon}
                        </Link>
                        {childrenOf(root.id).length > 0 && (
                          <ul className="mt-2 space-y-2 border-l border-line pl-4">
                            {childrenOf(root.id).map((c) => (
                              <li key={c.id}>
                                <Link href={`/categories/${c.slug}`} onClick={close} className="text-muted">
                                  {c.name}
                                  {c.is_coming_soon && comingSoon}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
            <li>
              <details className="group py-4">
                <summary className="flex list-none items-center justify-between font-serif text-2xl text-cocoa [&::-webkit-details-marker]:hidden">
                  Collections <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-3 space-y-3">
                  <li><Link href="/collections" onClick={close} className="text-cocoa">All collections</Link></li>
                  {collections.map((c) => (
                    <li key={c.id}>
                      <Link href={`/collections/${c.slug}`} onClick={close} className="text-muted">{c.name}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            <li><Link href="/about" onClick={close} className="block py-4 font-serif text-2xl text-cocoa">About</Link></li>
            <li><Link href="/contact" onClick={close} className="block py-4 font-serif text-2xl text-cocoa">Contact</Link></li>
            <li><Link href="/cart" onClick={close} className="block py-4 font-serif text-2xl text-cocoa">Cart{count > 0 ? ` (${count})` : ""}</Link></li>
          </ul>
        </nav>
      )}
    </header>
  );
}
