export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-blush-light/60" />
      <div className="h-40 animate-pulse rounded-xl bg-ivory" />
      <div className="h-64 animate-pulse rounded-xl bg-ivory" />
    </div>
  );
}
