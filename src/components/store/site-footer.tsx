import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { resolveWhatsAppNumber } from "@/lib/data/settings";
import { BRAND } from "@/lib/env";
import type { Category, StoreSettings } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const POLICIES = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
];

const heading = "mb-4 font-serif text-xl text-ivory";
const link = "inline-flex min-h-6 items-center text-sm text-ivory/75 transition-colors hover:text-blush hover:underline hover:underline-offset-4";

export function instagramHandle(url: string): string {
  const match = url.match(/instagram\.com\/([^/?#]+)/i);
  return match ? `@${match[1]}` : "Instagram";
}

export function SiteFooter({ categories, store }: { categories: Category[]; store: StoreSettings }) {
  const whatsapp = buildWhatsAppUrl(resolveWhatsAppNumber(store));
  const roots = categories.filter((c) => !c.parent_id);
  const hasContact = whatsapp || store.email || store.instagram_url || store.address;

  return (
    <footer className="mt-auto border-t-4 border-copper bg-cocoa text-ivory/75">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <p className="font-serif text-3xl tracking-[0.3em] text-ivory">EVARA</p>
          <p className="mt-2 font-serif text-base italic text-blush">{BRAND.tagline}</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-ivory/75">
            Artisan candles, thoughtfully designed to bring warmth, beauty and fragrance into your space.
          </p>
        </div>

        <nav aria-label="Shop">
          <h2 className={heading}>Shop</h2>
          <ul className="space-y-1.5">
            <li><Link href="/shop" className={link}>All products</Link></li>
            {roots.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.slug}`} className={link}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className={heading}>Evara</h2>
          <ul className="space-y-1.5">
            <li><Link href="/about" className={link}>Our story</Link></li>
            <li><Link href="/collections" className={link}>Collections</Link></li>
            <li><Link href="/contact" className={link}>Contact</Link></li>
            {POLICIES.map((p) => (
              <li key={p.href}><Link href={p.href} className={link}>{p.label}</Link></li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={heading}>Contact Us</h2>
          {hasContact ? (
            <ul className="space-y-3">
              {whatsapp && (
                <li>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${link} gap-2.5`}>
                    <WhatsAppIcon className="size-4 shrink-0 text-whatsapp" /> {store.phone_display || "WhatsApp us"}
                  </a>
                </li>
              )}
              {store.instagram_url && (
                <li>
                  <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className={`${link} gap-2.5`}>
                    <InstagramIcon className="size-4 shrink-0 text-blush" /> {instagramHandle(store.instagram_url)}
                  </a>
                </li>
              )}
              {store.email && (
                <li>
                  <a href={`mailto:${store.email}`} className={`${link} gap-2.5 break-all`}>
                    <Mail aria-hidden className="size-4 shrink-0 text-blush" strokeWidth={1.5} /> {store.email}
                  </a>
                </li>
              )}
              {store.address && (
                <li className="flex gap-2.5 text-sm text-ivory/75">
                  <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-blush" strokeWidth={1.5} /> {store.address}
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-ivory/75">
              Visit our <Link href="/contact" className="underline underline-offset-4 hover:text-blush">contact page</Link>.
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <p className="container-x py-6 text-xs tracking-wide text-ivory/75">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
