"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import {
  addProductImages,
  deleteProductImage,
  reorderProductImages,
  replaceProductImage,
  updateProductImage,
} from "@/app/admin/actions/catalog";
import { adminInput, adminLabel, btnPrimary, btnSecondary, Checkbox, ConfirmButton, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import { imageUrl } from "@/lib/format";
import type { ProductImage, ProductOption } from "@/lib/types";
import { MAX_IMAGE_BYTES } from "@/lib/validation";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-line bg-ivory hover:border-blush hover:bg-blush/30 disabled:opacity-30";

function ImageRow({ image, index, count, options, onMove, busy }: { image: ProductImage; index: number; count: number; options: ProductOption[]; onMove: (from: number, to: number) => void; busy: boolean }) {
  const { run, pending, result } = useAction();
  const [alt, setAlt] = useState(image.alt);
  const [valueId, setValueId] = useState(image.option_value_id ?? "");
  const [gallery, setGallery] = useState(image.show_in_gallery);
  const replaceInput = useRef<HTMLInputElement>(null);
  const src = imageUrl(image.storage_path);
  const dirty = alt !== image.alt || valueId !== (image.option_value_id ?? "") || gallery !== image.show_in_gallery;
  const disabled = pending || busy;

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line p-3 sm:flex-row">
      <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-lg bg-blush">
        {src && <Image src={src} alt={alt || "Product image"} fill sizes="112px" className="object-cover" />}
        {index === 0 && <span className="absolute left-1 top-1 rounded bg-ivory/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-cocoa">Main</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`alt-${image.id}`} className={adminLabel}>Description (alt text)</label>
            <input id={`alt-${image.id}`} value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} className={adminInput} />
          </div>
          <div>
            <label htmlFor={`link-${image.id}`} className={adminLabel}>Show when customer selects</label>
            <select id={`link-${image.id}`} value={valueId} onChange={(e) => setValueId(e.target.value)} className={adminInput}>
              <option value="">Not linked</option>
              {options.map((o) => (
                <optgroup key={o.id} label={o.name}>
                  {o.values.map((v) => (
                    <option key={v.id} value={v.id}>{v.value}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Checkbox label="Show in homepage gallery" checked={gallery} onChange={(e) => setGallery(e.target.checked)} />
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button type="button" className={iconBtn} disabled={disabled || index === 0} aria-label="Move image earlier" onClick={() => onMove(index, index - 1)}>
              <ArrowUp aria-hidden className="size-4" />
            </button>
            <button type="button" className={iconBtn} disabled={disabled || index === count - 1} aria-label="Move image later" onClick={() => onMove(index, index + 1)}>
              <ArrowDown aria-hidden className="size-4" />
            </button>
            <label className={`${btnSecondary} cursor-pointer !min-h-9 !px-3 text-xs ${disabled ? "pointer-events-none opacity-50" : ""}`}>
              <RefreshCw aria-hidden className="size-4" /> Replace
              <input
                ref={replaceInput}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={disabled}
                aria-label="Replace this image"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const data = new FormData();
                  data.set("image_id", image.id);
                  data.set("file", file);
                  run(() => replaceProductImage(data), { success: "Image replaced." });
                  e.target.value = "";
                }}
              />
            </label>
            <ConfirmButton
              title="Delete this image?"
              body="The image will be removed from the product and deleted from storage. This cannot be undone."
              confirmLabel="Delete image"
              disabled={disabled}
              className={`${iconBtn} text-copper-dark hover:!border-copper hover:!bg-blush/40`}
              onConfirm={() => run(() => deleteProductImage(image.id))}
            >
              <Trash2 aria-hidden className="size-4" />
              <span className="sr-only">Delete image</span>
            </ConfirmButton>
            <button
              type="button"
              className={`${btnPrimary} !min-h-9 !px-3 text-xs`}
              disabled={disabled || !dirty}
              onClick={() => run(() => updateProductImage({ id: image.id, alt, option_value_id: valueId, show_in_gallery: gallery }), { success: "Saved." })}
            >
              {pending && <Spinner />} Save
            </button>
          </div>
        </div>
        <Notice result={result} />
      </div>
    </li>
  );
}

export function ProductImages({ productId, images, options }: { productId: string; images: ProductImage[]; options: ProductOption[] }) {
  const { run, pending, result } = useAction();
  const [clientError, setClientError] = useState<string | null>(null);

  const upload = (files: FileList | null) => {
    setClientError(null);
    if (!files?.length) return;
    const list = [...files];
    if (list.length > 8) return setClientError("Upload up to 8 images at a time.");
    const tooBig = list.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) return setClientError(`"${tooBig.name}" is larger than 4 MB.`);
    // One request per file keeps each upload under the server's request size limit.
    run(
      async () => {
        let added = 0;
        for (const file of list) {
          const data = new FormData();
          data.set("product_id", productId);
          data.append("files", file);
          const res = await addProductImages(data);
          if (!res.ok) return added ? { ok: false as const, error: `${added} uploaded. ${res.error}` } : res;
          added += res.added;
        }
        return { ok: true as const, added };
      },
      { success: "Images uploaded." },
    );
  };

  const move = (from: number, to: number) => {
    const ids = images.map((i) => i.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    run(() => reorderProductImages({ product_id: productId, ids }));
  };

  return (
    <Panel
      title="Images"
      description="The first image is the main photo. JPEG, PNG, WebP or AVIF, up to 4 MB each. Changes here save immediately."
      actions={
        <label className={`${btnSecondary} cursor-pointer ${pending ? "pointer-events-none opacity-50" : ""}`}>
          {pending ? <Spinner /> : <ImagePlus aria-hidden className="size-4" />} Upload images
          <input type="file" accept={ACCEPT} multiple className="sr-only" disabled={pending} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      }
    >
      <div className="space-y-3">
        <Notice result={clientError ? { ok: false, message: clientError } : result} />
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-blush px-4 py-8 text-center text-sm text-muted">No images yet. Upload photos to show this product on the store.</p>
        ) : (
          <ul className="space-y-3">
            {images.map((image, i) => (
              <ImageRow key={image.id} image={image} index={i} count={images.length} options={options} onMove={move} busy={pending} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
