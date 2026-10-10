import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { PageHeader } from "@/components/store/bits";
import { instagramHandle } from "@/components/store/site-footer";
import { getSettings, resolveWhatsAppNumber } from "@/lib/data/settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Evara Studios about an order, a custom piece or gifting.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const { store } = await getSettings();
  const whatsapp = buildWhatsAppUrl(resolveWhatsAppNumber(store), "Hello Evara Studios!");

  const cards = [
    whatsapp && { key: "wa", icon: <WhatsAppIcon className="size-6 text-whatsapp" />, title: "WhatsApp", value: store.phone_display || "Chat with us", href: whatsapp, external: true },
    store.email && { key: "mail", icon: <Mail aria-hidden className="size-6" strokeWidth={1.5} />, title: "Email", value: store.email, href: `mailto:${store.email}`, external: false },
    store.instagram_url && { key: "ig", icon: <InstagramIcon className="size-6" />, title: "Instagram", value: instagramHandle(store.instagram_url), href: store.instagram_url, external: true },
  ].filter((c): c is Exclude<typeof c, "" | null | false> => Boolean(c));

  return (
    <>
      <PageHeader eyebrow="Say hello" title="We'd love to hear from you" intro="Whether you have a question about an order, want to discuss a custom piece, or are exploring gifting — we're happy to help." />
      <div className="container-x py-12 sm:py-20">
        {cards.length === 0 ? (
          <p className="mx-auto max-w-md text-center text-muted" role="status">
            Our contact details are being updated. Please check back shortly.
          </p>
        ) : (
          <ul className={`mx-auto grid gap-5 ${cards.length >= 3 ? "max-w-4xl sm:grid-cols-3" : cards.length === 2 ? "max-w-2xl sm:grid-cols-2" : "max-w-xs"}`}>
            {cards.map((c) => (
              <li key={c.key}>
                <a href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="card group flex h-full flex-col items-center p-8 text-center transition-shadow hover:shadow-lift">
                  <span className="flex size-14 items-center justify-center rounded-full bg-blush-light text-copper">{c.icon}</span>
                  <span className="mt-5 font-serif text-2xl text-cocoa">{c.title}</span>
                  <span className="mt-1 break-all text-sm font-medium text-copper-dark group-hover:underline group-hover:underline-offset-4">{c.value}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {(store.business_hours || store.address) && (
          <dl className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-4 text-center text-sm text-muted">
            {store.business_hours && (
              <div className="flex items-center gap-2.5">
                <dt><Clock aria-hidden className="size-4" strokeWidth={1.5} /><span className="sr-only">Hours</span></dt>
                <dd>{store.business_hours}</dd>
              </div>
            )}
            {store.address && (
              <div className="flex items-center gap-2.5">
                <dt><MapPin aria-hidden className="size-4" strokeWidth={1.5} /><span className="sr-only">Address</span></dt>
                <dd>{store.address}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </>
  );
}
