"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="rounded-xl border border-blush bg-blush/40 p-6 text-cocoa">
      <h1 className="font-sans text-lg font-semibold">This page could not be loaded</h1>
      <p className="mt-1 text-sm">Check your connection and that the database migrations have been applied, then try again.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-lg bg-copper-dark px-4 py-2 text-sm font-medium text-ivory hover:bg-cocoa">
        Try again
      </button>
    </div>
  );
}
