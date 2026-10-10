"use client";

import { useEffect } from "react";
import { ArchOrnament } from "@/components/icons";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-x flex flex-col items-center py-24 text-center" role="alert">
      <ArchOrnament className="w-20 text-blush" />
      <h1 className="mt-6 text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-muted">We could not load this page. Please try again in a moment.</p>
      <button type="button" onClick={reset} className="btn-primary mt-8">Try again</button>
    </div>
  );
}
