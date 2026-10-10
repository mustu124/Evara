"use client";

import Image from "next/image";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteTaxonomy, saveTaxonomy } from "@/app/admin/actions/catalog";
import { AdminEmpty, Badge } from "@/components/admin/bits";
import { ImageField } from "@/components/admin/image-field";
import { adminInput, adminLabel, btnPrimary, btnSecondary, Checkbox, ConfirmButton, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import { imageUrl, slugify } from "@/lib/format";
import type { Category, Collection } from "@/lib/types";

type Kind = "categories" | "collections";
type Item = (Category | Collection) & { parent_id?: string | null; is_coming_soon?: boolean };

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  is_coming_soon: boolean;
};

const toDraft = (item?: Item, nextSort = 0): Draft => ({
  id: item?.id,
  name: item?.name ?? "",
  slug: item?.slug ?? "",
  description: item?.description ?? "",
  parent_id: item?.parent_id ?? "",
  image_path: item?.image_path ?? null,
  sort_order: item?.sort_order ?? nextSort,
  is_active: item?.is_active ?? true,
  is_coming_soon: item?.is_coming_soon ?? false,
});

function Editor({ kind, draft: initial, items, onDone }: { kind: Kind; draft: Draft; items: Item[]; onDone: () => void }) {
  const [draft, setDraft] = useState(initial);
  const { run, pending, result } = useAction();
  const isCategory = kind === "categories";
  const singular = isCategory ? "category" : "collection";
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  // Only top-level categories can be parents, and never the category itself.
  const parents = items.filter((i) => !i.parent_id && i.id !== draft.id);

  return (
    <form
      className="space-y-4 rounded-lg border border-blush bg-blush-light/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveTaxonomy(kind, draft), { onSuccess: onDone });
      }}
    >
      <p className="font-medium text-cocoa">{draft.id ? `Edit ${singular}` : `New ${singular}`}</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="t-name" className={adminLabel}>Name</label>
            <input id="t-name" required value={draft.name} className={adminInput} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, slug: d.id ? d.slug : slugify(e.target.value) }))} />
          </div>
          <div>
            <label htmlFor="t-slug" className={adminLabel}>URL slug</label>
            <input id="t-slug" required value={draft.slug} className={adminInput} onChange={(e) => set("slug", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="t-description" className={adminLabel}>Description (optional)</label>
            <textarea id="t-description" rows={2} value={draft.description} className={adminInput} onChange={(e) => set("description", e.target.value)} />
          </div>
          {isCategory && (
            <div>
              <label htmlFor="t-parent" className={adminLabel}>Parent category</label>
              <select id="t-parent" value={draft.parent_id} className={adminInput} onChange={(e) => set("parent_id", e.target.value)}>
                <option value="">None (top level)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="t-sort" className={adminLabel}>Sort order</label>
            <input id="t-sort" type="number" min={0} value={draft.sort_order} className={adminInput} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
          </div>
          <div className="sm:col-span-2">
            <Checkbox label="Visible on the store" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            {isCategory && <Checkbox label="Coming soon" hint="Shown with a Coming soon label." checked={draft.is_coming_soon} onChange={(e) => set("is_coming_soon", e.target.checked)} />}
          </div>
        </div>
        <div>
          <p className={adminLabel}>Image</p>
          <ImageField bucket="collection-images" folder={kind} value={draft.image_path} onChange={(ref) => set("image_path", ref)} label={`${singular} image`} />
        </div>
      </div>
      <Notice result={result} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Spinner />} Save</button>
        <button type="button" disabled={pending} className={btnSecondary} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function TaxonomyManager({ kind, items }: { kind: Kind; items: Item[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { run, pending, result } = useAction();
  const isCategory = kind === "categories";
  const singular = isCategory ? "category" : "collection";

  // Categories are shown as a tree: each top-level category followed by its children.
  const ordered: { item: Item; depth: number }[] = isCategory
    ? items
        .filter((i) => !i.parent_id || !items.some((p) => p.id === i.parent_id))
        .flatMap((root) => [{ item: root, depth: 0 }, ...items.filter((c) => c.parent_id === root.id).map((c) => ({ item: c, depth: 1 }))])
    : items.map((item) => ({ item, depth: 0 }));
  const nextSort = Math.max(0, ...items.map((i) => i.sort_order)) + 10;

  return (
    <Panel
      actions={
        editing === null && (
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> New {singular}
          </button>
        )
      }
      title={`${items.length} ${items.length === 1 ? singular : kind}`}
    >
      <div className="space-y-3">
        <Notice result={result} />
        {editing === "new" && <Editor kind={kind} draft={toDraft(undefined, nextSort)} items={items} onDone={() => setEditing(null)} />}
        {items.length === 0 && editing !== "new" ? (
          <AdminEmpty title={`No ${kind} yet`} body={`Run the seed script to load the Evara ${kind}, or create one.`} />
        ) : (
          <ul className="divide-y divide-line">
            {ordered.map(({ item, depth }) =>
              editing === item.id ? (
                <li key={item.id} className="py-3">
                  <Editor kind={kind} draft={toDraft(item)} items={items} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={item.id} className={`flex flex-wrap items-center gap-3 py-3 ${depth ? "pl-6 sm:pl-10" : ""}`}>
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-blush">
                    {imageUrl(item.image_path) && <Image src={imageUrl(item.image_path)!} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cocoa">{item.name}</p>
                    <p className="truncate text-xs text-muted">/{kind}/{item.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!item.is_active && <Badge>Hidden</Badge>}
                    {item.is_coming_soon && <Badge tone="rose">Coming soon</Badge>}
                    <button type="button" className={`${btnSecondary} !min-h-9 !px-3 text-xs`} disabled={pending || editing !== null} onClick={() => setEditing(item.id)}>
                      <Pencil aria-hidden className="size-3.5" /> Edit
                    </button>
                    <ConfirmButton
                      title={`Delete "${item.name}"?`}
                      body={isCategory ? "Categories that still contain products or sub-categories cannot be deleted. This cannot be undone." : "Products stay in the catalog but are removed from this collection. This cannot be undone."}
                      confirmLabel="Delete"
                      disabled={pending || editing !== null}
                      className={`${btnSecondary} !min-h-9 !border-blush !px-3 text-xs !text-copper-dark hover:!bg-blush/40`}
                      onConfirm={() => run(() => deleteTaxonomy(kind, item.id), { success: `"${item.name}" deleted.` })}
                    >
                      <Trash2 aria-hidden className="size-3.5" /> Delete
                    </ConfirmButton>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </Panel>
  );
}
