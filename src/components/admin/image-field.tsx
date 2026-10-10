"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { uploadImage } from "@/app/admin/actions/catalog";
import { btnSecondary, Spinner } from "@/components/admin/ui";
import { imageUrl } from "@/lib/format";
import { MAX_IMAGE_BYTES, type ImageBucket } from "@/lib/validation";

type Props = {
  bucket: ImageBucket;
  folder: string;
  value: string | null;
  onChange: (ref: string | null) => void;
  label?: string;
  /** Tailwind aspect class for the preview. */
  aspect?: string;
};

/**
 * Uploads one image and reports its storage reference. The previous image is
 * deleted from storage by the server when the surrounding form is saved.
 */
export function ImageField({ bucket, folder, value, onChange, label = "Image", aspect = "aspect-[4/5]" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = imageUrl(value);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Images must be 4 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("bucket", bucket);
      data.set("folder", folder);
      const result = await uploadImage(data);
      if (result.ok) onChange(result.ref);
      else setError(result.error);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className={`relative ${aspect} w-full max-w-40 overflow-hidden rounded-lg border border-dashed border-blush bg-blush`}>
        {src ? (
          <Image src={src} alt={`${label} preview`} fill sizes="160px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">No image</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-ivory/70 text-copper-dark" role="status">
            <Spinner />
            <span className="sr-only">Uploading</span>
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className={`${btnSecondary} cursor-pointer !min-h-9 !px-3 text-xs ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <ImagePlus aria-hidden className="size-4" /> {src ? "Replace" : "Upload"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} aria-label={`${src ? "Replace" : "Upload"} ${label.toLowerCase()}`} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {src && (
          <button type="button" className={`${btnSecondary} !min-h-9 !px-3 text-xs`} disabled={busy} onClick={() => onChange(null)}>
            <Trash2 aria-hidden className="size-4" /> Remove
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-cocoa">{error}</p>}
    </div>
  );
}
