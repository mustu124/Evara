"use client";

import Link from "next/link";
import { deleteProduct, setProductStatus } from "@/app/admin/actions/catalog";
import { btnSecondary, ConfirmButton, Spinner, useAction } from "@/components/admin/ui";
import type { ProductStatus } from "@/lib/types";

const small = `${btnSecondary} !min-h-9 !px-3 text-xs`;

export function ProductRowActions({ id, name, status }: { id: string; name: string; status: ProductStatus }) {
  const { run, pending, result } = useAction();
  const set = (next: ProductStatus) => run(() => setProductStatus({ id, status: next }));

  return (
    <div className="flex w-full flex-col items-end gap-1 sm:w-auto">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {pending && <Spinner />}
        <Link href={`/admin/products/${id}`} className={small}>Edit</Link>
        {status === "published" && (
          <button type="button" className={small} disabled={pending} onClick={() => set("draft")}>Unpublish</button>
        )}
        {status === "draft" && (
          <button type="button" className={small} disabled={pending} onClick={() => set("published")}>Publish</button>
        )}
        {status === "archived" ? (
          <>
            <button type="button" className={small} disabled={pending} onClick={() => set("draft")}>Restore</button>
            <ConfirmButton
              title={`Delete "${name}" permanently?`}
              body="The product, its pack sizes, options and photos will be deleted for good. Past orders keep their own record of it. This cannot be undone."
              confirmLabel="Delete permanently"
              disabled={pending}
              className={`${small} !border-blush !text-copper-dark hover:!bg-blush/40`}
              onConfirm={() => run(() => deleteProduct(id))}
            >
              Delete
            </ConfirmButton>
          </>
        ) : (
          <ConfirmButton
            title={`Archive "${name}"?`}
            body="It will be removed from the store immediately. Past orders are kept, and you can restore it later from the Archived filter."
            confirmLabel="Archive"
            disabled={pending}
            className={`${small} !border-blush !text-copper-dark hover:!bg-blush/40`}
            onConfirm={() => set("archived")}
          >
            Archive
          </ConfirmButton>
        )}
      </div>
      {result && !result.ok && <p role="alert" className="text-xs font-medium text-cocoa">{result.message}</p>}
    </div>
  );
}
