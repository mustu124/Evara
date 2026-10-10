"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { setBestsellers } from "@/app/admin/actions/catalog";
import { deleteTestimonial, saveAbout, saveHomepage, saveTestimonial } from "@/app/admin/actions/content";
import { Badge } from "@/components/admin/bits";
import { ImageField } from "@/components/admin/image-field";
import { adminInput, adminLabel, btnPrimary, btnSecondary, Checkbox, ConfirmButton, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import type { AboutSettings, HomepageSettings, ProductStatus, Testimonial } from "@/lib/types";

const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-line bg-ivory hover:border-blush hover:bg-blush/30 disabled:opacity-30";

const SECTION_LABELS: Partial<Record<keyof HomepageSettings["sections"], string>> = {
  categories: "Shop by Category",
  bestsellers: "Bestsellers",
  collections: "Shop by Collection",
  gallery: "Gallery",
  testimonials: "Customer reviews",
};

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/* ───────────── Hero banner + section visibility ───────────── */

export function HomepageEditor({ initial }: { initial: HomepageSettings }) {
  const [hero, setHero] = useState(initial.hero);
  const [sections, setSections] = useState(initial.sections);
  const { run, pending, result } = useAction();
  const setText = (key: "eyebrow" | "heading" | "cta_label" | "cta_href", value: string) => setHero((h) => ({ ...h, [key]: value }));
  const setSlides = (slides: HomepageSettings["hero"]["slides"]) => setHero((h) => ({ ...h, slides }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHomepage({ hero, sections }), { success: "Homepage saved. The store has been updated." });
      }}
    >
      <Panel title="Hero banner" description="A full-width slideshow with the heading and button over the photo. Wide (landscape) photos of at least 1920 px look sharpest.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="h-eyebrow" className={adminLabel}>Small line above the heading</label>
            <input id="h-eyebrow" value={hero.eyebrow} maxLength={80} onChange={(e) => setText("eyebrow", e.target.value)} className={adminInput} />
          </div>
          <div>
            <label htmlFor="h-heading" className={adminLabel}>Heading</label>
            <input id="h-heading" required value={hero.heading} maxLength={120} onChange={(e) => setText("heading", e.target.value)} className={adminInput} />
          </div>
          <div>
            <label htmlFor="h-cta" className={adminLabel}>Button label</label>
            <input id="h-cta" required value={hero.cta_label} maxLength={40} onChange={(e) => setText("cta_label", e.target.value)} className={adminInput} />
          </div>
          <div>
            <label htmlFor="h-href" className={adminLabel}>Button link</label>
            <input id="h-href" required value={hero.cta_href} placeholder="/shop" onChange={(e) => setText("cta_href", e.target.value)} className={adminInput} />
          </div>
        </div>

        <p className={`${adminLabel} mt-6`}>Banner images (shown as a slideshow)</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hero.slides.map((slide, i) => (
            <li key={slide.image_path} className="rounded-lg border border-line p-3">
              <ImageField
                bucket="homepage-images"
                folder="hero"
                value={slide.image_path}
                label={`Banner image ${i + 1}`}
                onChange={(ref) => setSlides(ref ? hero.slides.map((s, j) => (j === i ? { ...s, image_path: ref } : s)) : hero.slides.filter((_, j) => j !== i))}
              />
              <label htmlFor={`slide-alt-${i}`} className={`${adminLabel} mt-3`}>Description</label>
              <input id={`slide-alt-${i}`} value={slide.alt} maxLength={160} onChange={(e) => setSlides(hero.slides.map((s, j) => (j === i ? { ...s, alt: e.target.value } : s)))} className={adminInput} />
              <div className="mt-2 flex gap-1">
                <button type="button" className={iconBtn} disabled={i === 0} aria-label={`Move banner image ${i + 1} earlier`} onClick={() => setSlides(move(hero.slides, i, i - 1))}>
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button type="button" className={iconBtn} disabled={i === hero.slides.length - 1} aria-label={`Move banner image ${i + 1} later`} onClick={() => setSlides(move(hero.slides, i, i + 1))}>
                  <ArrowDown aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {hero.slides.length < 8 && (
            <li className="rounded-lg border border-dashed border-blush p-3">
              <p className="mb-2 text-xs text-muted">Add an image</p>
              <ImageField bucket="homepage-images" folder="hero" value={null} label="new banner image" onChange={(ref) => ref && setSlides([...hero.slides, { image_path: ref, alt: "" }])} />
            </li>
          )}
        </ul>
      </Panel>

      <Panel title="Homepage sections" description="Hide a section without deleting its content. Sections with nothing to show are hidden automatically.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(SECTION_LABELS) as [keyof HomepageSettings["sections"], string][]).map(([key, label]) => (
            <Checkbox key={key} label={label} checked={sections[key]} onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))} />
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Spinner />} Save homepage</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

/* ───────────── Bestsellers ───────────── */

export function BestsellerPicker({ products }: { products: { id: string; name: string; status: ProductStatus; is_bestseller: boolean }[] }) {
  const [selected, setSelected] = useState(() => new Set(products.filter((p) => p.is_bestseller).map((p) => p.id)));
  const { run, pending, result } = useAction();

  return (
    <Panel title="Bestsellers" description="Choose the products featured in the homepage Bestsellers section (up to 8 are shown). Only published products appear on the store.">
      {products.length === 0 ? (
        <p className="text-sm text-muted">No products yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2">
          {products.map((p) => (
            <Checkbox
              key={p.id}
              label={p.name}
              hint={p.status === "published" ? undefined : `Not published (${p.status})`}
              checked={selected.has(p.id)}
              onChange={(e) =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(p.id);
                  else next.delete(p.id);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || products.length === 0} className={btnPrimary} onClick={() => run(() => setBestsellers({ ids: [...selected] }), { success: "Bestsellers updated." })}>
          {pending && <Spinner />} Save bestsellers
        </button>
        <Notice result={result} />
      </div>
    </Panel>
  );
}

/* ───────────── Founders' story ───────────── */

export function AboutEditor({ initial }: { initial: AboutSettings }) {
  const [story, setStory] = useState(initial.story);
  const [founders, setFounders] = useState(initial.founders);
  const { run, pending, result } = useAction();

  return (
    <Panel title="Founders' story" description="Shown on the About page. Leave a blank line between paragraphs.">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveAbout({ story, founders }), { success: "Story saved. The store has been updated." });
        }}
      >
        <div>
          <label htmlFor="a-story" className={adminLabel}>Story</label>
          <textarea id="a-story" rows={12} value={story} maxLength={10000} onChange={(e) => setStory(e.target.value)} className={adminInput} />
        </div>
        <div>
          <p className={adminLabel}>Founder photos</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {founders.map((f, i) => (
              <li key={f.image_path} className="rounded-lg border border-line p-3">
                <ImageField
                  bucket="founder-images"
                  folder="founders"
                  value={f.image_path}
                  aspect="aspect-[4/5]"
                  label={`Founder photo ${i + 1}`}
                  onChange={(ref) => setFounders(ref ? founders.map((x, j) => (j === i ? { ...x, image_path: ref } : x)) : founders.filter((_, j) => j !== i))}
                />
                <label htmlFor={`founder-name-${i}`} className={`${adminLabel} mt-3`}>Name</label>
                <input id={`founder-name-${i}`} value={f.name} maxLength={80} onChange={(e) => setFounders(founders.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={adminInput} />
              </li>
            ))}
            {founders.length < 6 && (
              <li className="rounded-lg border border-dashed border-blush p-3">
                <p className="mb-2 text-xs text-muted">Add a photo</p>
                <ImageField bucket="founder-images" folder="founders" value={null} aspect="aspect-[4/5]" label="new founder photo" onChange={(ref) => ref && setFounders([...founders, { name: "", image_path: ref }])} />
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Spinner />} Save story</button>
          <Notice result={result} />
        </div>
      </form>
    </Panel>
  );
}

/* ───────────── Testimonials ───────────── */

type TestimonialDraft = { id?: string; author_name: string; author_location: string; quote: string; rating: string; is_published: boolean; sort_order: number };

function TestimonialEditor({ draft: initial, onDone }: { draft: TestimonialDraft; onDone: () => void }) {
  const [draft, setDraft] = useState(initial);
  const { run, pending, result } = useAction();
  const set = <K extends keyof TestimonialDraft>(key: K, value: TestimonialDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="space-y-4 rounded-lg border border-blush bg-blush-light/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveTestimonial(draft), { onSuccess: onDone });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="r-name" className={adminLabel}>Customer name</label>
          <input id="r-name" required value={draft.author_name} maxLength={120} onChange={(e) => set("author_name", e.target.value)} className={adminInput} />
        </div>
        <div>
          <label htmlFor="r-location" className={adminLabel}>City (optional)</label>
          <input id="r-location" value={draft.author_location} maxLength={120} onChange={(e) => set("author_location", e.target.value)} className={adminInput} />
        </div>
        <div>
          <label htmlFor="r-rating" className={adminLabel}>Rating (optional)</label>
          <select id="r-rating" value={draft.rating} onChange={(e) => set("rating", e.target.value)} className={adminInput}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="r-quote" className={adminLabel}>Review, in the customer&rsquo;s own words</label>
          <textarea id="r-quote" required rows={3} value={draft.quote} maxLength={1000} onChange={(e) => set("quote", e.target.value)} className={adminInput} />
        </div>
      </div>
      <Checkbox label="Show on the store" checked={draft.is_published} onChange={(e) => set("is_published", e.target.checked)} />
      <Notice result={result} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Spinner />} Save review</button>
        <button type="button" disabled={pending} className={btnSecondary} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function TestimonialsManager({ testimonials }: { testimonials: Testimonial[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { run, pending, result } = useAction();
  const toDraft = (t?: Testimonial): TestimonialDraft => ({
    id: t?.id,
    author_name: t?.author_name ?? "",
    author_location: t?.author_location ?? "",
    quote: t?.quote ?? "",
    rating: t?.rating ? String(t.rating) : "",
    is_published: t?.is_published ?? true,
    sort_order: t?.sort_order ?? testimonials.length * 10,
  });

  return (
    <Panel
      title="Customer reviews"
      description="Add only genuine reviews from real customers. The section stays hidden on the store until at least one review is published."
      actions={
        editing === null && (
          <button type="button" className={btnSecondary} onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> Add review
          </button>
        )
      }
    >
      <div className="space-y-3">
        <Notice result={result} />
        {editing === "new" && <TestimonialEditor draft={toDraft()} onDone={() => setEditing(null)} />}
        {testimonials.length === 0 && editing !== "new" && <p className="text-sm text-muted">No reviews have been added yet.</p>}
        <ul className="divide-y divide-line">
          {testimonials.map((t) =>
            editing === t.id ? (
              <li key={t.id} className="py-3"><TestimonialEditor draft={toDraft(t)} onDone={() => setEditing(null)} /></li>
            ) : (
              <li key={t.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">&ldquo;{t.quote}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted">
                    {t.author_name}{t.author_location ? `, ${t.author_location}` : ""}{t.rating ? ` · ${t.rating}/5` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={t.is_published ? "green" : "neutral"}>{t.is_published ? "Published" : "Hidden"}</Badge>
                  <button type="button" className={iconBtn} disabled={pending || editing !== null} aria-label={`Edit review by ${t.author_name}`} onClick={() => setEditing(t.id)}>
                    <Pencil aria-hidden className="size-4" />
                  </button>
                  <ConfirmButton title="Delete this review?" body="This cannot be undone." confirmLabel="Delete" disabled={pending || editing !== null} className={`${iconBtn} text-copper-dark hover:!border-copper hover:!bg-blush/40`} onConfirm={() => run(() => deleteTestimonial(t.id), { success: "Review deleted." })}>
                    <Trash2 aria-hidden className="size-4" />
                    <span className="sr-only">Delete review by {t.author_name}</span>
                  </ConfirmButton>
                </div>
              </li>
            ),
          )}
        </ul>
      </div>
    </Panel>
  );
}
