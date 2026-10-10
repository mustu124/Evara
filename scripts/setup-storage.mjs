// Creates (or updates) the four public image buckets and verifies them.
// Idempotent: safe to run as many times as you like.
//
//   npm run db:storage
//
// Write/delete permissions are enforced by the storage policies in
// supabase/migrations/0002_storage.sql, which must also be applied.
import { BUCKETS, fail, getServiceClient, info, ok } from "./_client.mjs";

const OPTIONS = {
  public: true, // storefront photography is intentionally world-readable
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
};

const supabase = getServiceClient();

const { data: existing, error: listError } = await supabase.storage.listBuckets();
if (listError) fail(`Could not list buckets: ${listError.message}`);
const have = new Set(existing.map((b) => b.id));

for (const bucket of BUCKETS) {
  if (have.has(bucket)) {
    const { error } = await supabase.storage.updateBucket(bucket, OPTIONS);
    if (error) fail(`Could not update bucket "${bucket}": ${error.message}`);
    ok(`${bucket}: already existed, settings updated`);
  } else {
    const { error } = await supabase.storage.createBucket(bucket, OPTIONS);
    if (error) fail(`Could not create bucket "${bucket}": ${error.message}`);
    ok(`${bucket}: created`);
  }
}

// Verify rather than assume.
const { data: after, error: verifyError } = await supabase.storage.listBuckets();
if (verifyError) fail(`Could not verify buckets: ${verifyError.message}`);
const problems = BUCKETS.filter((id) => {
  const b = after.find((x) => x.id === id);
  return !b || !b.public;
});
if (problems.length) fail(`Verification failed for: ${problems.join(", ")}`);

console.log("\nAll four buckets exist and are public-read.");
info("Reminder: apply supabase/migrations/0002_storage.sql so only administrators can upload, replace or delete.");
