// Seeds the Evara Studios catalog from scripts/catalog-data.mjs and uploads
// the supplied photography from supabase/seed-assets to Supabase Storage.
//
//   npm run db:seed
//
// Idempotent and non-destructive: anything that already exists (matched by
// slug or settings key) is left untouched, so it never overwrites edits made
// in the admin panel. Requires the migrations and `npm run db:storage` first.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, getServiceClient, info, ok } from "./_client.mjs";
import { categories, collectionImages, collections, founders, foundersStory, heroSlides, products, slugify } from "./catalog-data.mjs";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed-assets");
const supabase = getServiceClient();

const check = (error, what) => {
  if (error) fail(`${what}: ${error.message}`);
};

/** Uploads a seed asset to a stable path and returns its "<bucket>/<path>" reference. */
async function upload(bucket, file) {
  const path = `seed/${file}`;
  const body = await readFile(join(ASSETS, file));
  let last;
  // Uploads occasionally fail on a flaky connection, so try a few times.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: true,
      });
      if (!error) return `${bucket}/${path}`;
      last = error;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  const reason = last?.message || last?.cause?.message || last?.statusCode || String(last);
  fail(`Upload of ${file} to ${bucket} failed after 4 attempts: ${reason}
Check your connection (and that "npm run db:storage" has been run), then run the seed again; it resumes where it stopped.`);
}

// ── preflight ────────────────────────────────────────────────────────────
{
  const { error } = await supabase.from("categories").select("id").limit(1);
  if (error) fail(`The database schema is not ready (${error.message}).\nApply supabase/migrations/0001_schema.sql and 0002_storage.sql first.`);
}

// ── categories ───────────────────────────────────────────────────────────
const categoryIds = new Map();
async function seedCategory(cat, parentId, sort) {
  const slug = slugify(cat.name);
  const { data: existing, error: readError } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
  check(readError, `Reading category ${cat.name}`);
  if (existing) {
    categoryIds.set(cat.name, existing.id);
    return false;
  }
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: cat.name,
      slug,
      parent_id: parentId,
      sort_order: sort,
      is_coming_soon: Boolean(cat.comingSoon),
      image_path: cat.image ? await upload("collection-images", cat.image) : null,
    })
    .select("id")
    .single();
  check(error, `Creating category ${cat.name}`);
  categoryIds.set(cat.name, data.id);
  return true;
}

let createdCategories = 0;
for (const [i, cat] of categories.entries()) {
  if (await seedCategory(cat, null, (i + 1) * 10)) createdCategories++;
  for (const [j, child] of (cat.children ?? []).entries()) {
    if (await seedCategory(child, categoryIds.get(cat.name), (j + 1) * 10)) createdCategories++;
  }
}
ok(`Categories: ${createdCategories} created, ${categoryIds.size - createdCategories} already present`);

// ── collections ──────────────────────────────────────────────────────────
let createdCollections = 0;
let collectionCovers = 0;
for (const [i, name] of collections.entries()) {
  const slug = slugify(name);
  const cover = collectionImages[slug];
  const { data: existing, error: readError } = await supabase.from("collections").select("id, image_path").eq("slug", slug).maybeSingle();
  check(readError, `Reading collection ${name}`);
  if (existing) {
    // Only fills a missing cover photo; never replaces one chosen in the admin panel.
    if (!existing.image_path && cover) {
      const { error } = await supabase.from("collections").update({ image_path: await upload("collection-images", cover) }).eq("id", existing.id);
      check(error, `Adding a cover photo to ${name}`);
      collectionCovers++;
    }
    continue;
  }
  const { error } = await supabase
    .from("collections")
    .insert({ name, slug, sort_order: (i + 1) * 10, image_path: cover ? await upload("collection-images", cover) : null });
  check(error, `Creating collection ${name}`);
  createdCollections++;
}
if (collectionCovers) info(`Added cover photos to ${collectionCovers} existing collection(s)`);
ok(`Collections: ${createdCollections} created, ${collections.length - createdCollections} already present`);

// ── products ─────────────────────────────────────────────────────────────
let createdProducts = 0;
for (const [i, p] of products.entries()) {
  const slug = slugify(p.name);
  const { data: existing, error: readError } = await supabase.from("products").select("id, status").eq("slug", slug).maybeSingle();
  check(readError, `Reading product ${p.name}`);
  if (existing) {
    // A draft with no photos is what an interrupted seed leaves behind: rebuild it.
    const { count: imageCount } = await supabase.from("product_images").select("*", { count: "exact", head: true }).eq("product_id", existing.id);
    if (existing.status === "draft" && !imageCount) {
      const { error: removeError } = await supabase.from("products").delete().eq("id", existing.id);
      check(removeError, `Removing the incomplete ${p.name}`);
      info(`${p.name}: found an incomplete earlier attempt, rebuilding it`);
    } else {
      info(`${p.name}: already present, left unchanged`);
      continue;
    }
  }

  // Photos go up first, so a failed upload never leaves a half-built product.
  const uploaded = [];
  for (const image of p.images) uploaded.push(await upload("product-images", image.file));

  // Created as a draft and published only once every part is in place.
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: p.name,
      slug,
      description: p.description,
      category_id: categoryIds.get(p.category) ?? null,
      status: "draft",
      // The brief asks for a Bestsellers section but does not say which
      // products sell best; the whole launch range is featured by default.
      // Change this any time in Admin → Homepage.
      is_bestseller: true,
      specifications: p.specifications,
      sort_order: (i + 1) * 10,
      // Stock levels were not supplied, so stock is not tracked by default.
      track_inventory: false,
    })
    .select("id")
    .single();
  check(error, `Creating product ${p.name}`);

  const { error: variantError } = await supabase.from("product_variants").insert(
    p.packs.map((pack, j) => ({
      product_id: product.id,
      label: pack.label,
      pack_quantity: pack.pack,
      price: pack.price,
      compare_at_price: pack.compareAt,
      sort_order: j,
    })),
  );
  check(variantError, `Creating pack sizes for ${p.name}`);

  const valueIds = new Map();
  for (const [j, option] of p.options.entries()) {
    const { data: opt, error: optionError } = await supabase
      .from("product_options")
      .insert({ product_id: product.id, name: option.name, kind: option.kind, sort_order: j })
      .select("id")
      .single();
    check(optionError, `Creating option ${option.name} for ${p.name}`);
    const { data: values, error: valueError } = await supabase
      .from("product_option_values")
      .insert(
        option.values.map((v, k) => {
          const value = typeof v === "string" ? v : v.value;
          const comingSoon = typeof v !== "string" && Boolean(v.comingSoon);
          return { option_id: opt.id, value, is_coming_soon: comingSoon, is_available: !comingSoon, sort_order: k };
        }),
      )
      .select("id, value");
    check(valueError, `Creating ${option.name} values for ${p.name}`);
    for (const v of values) valueIds.set(v.value, v.id);
  }

  const imageRows = [];
  for (const [j, image] of p.images.entries()) {
    imageRows.push({
      product_id: product.id,
      storage_path: uploaded[j],
      alt: image.alt,
      option_value_id: image.link ? (valueIds.get(image.link) ?? null) : null,
      show_in_gallery: Boolean(image.gallery),
      sort_order: j,
    });
  }
  const { error: imageError } = await supabase.from("product_images").insert(imageRows);
  check(imageError, `Creating images for ${p.name}`);

  const { error: publishError } = await supabase.from("products").update({ status: "published" }).eq("id", product.id);
  check(publishError, `Publishing ${p.name}`);
  createdProducts++;
  info(`${p.name}: created with ${p.packs.length} pack sizes and ${p.images.length} images`);
}
ok(`Products: ${createdProducts} created, ${products.length - createdProducts} already present`);

// ── site settings (only keys that do not exist yet) ──────────────────────
async function seedSetting(key, build) {
  const { data: existing, error: readError } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
  check(readError, `Reading setting ${key}`);
  if (existing) return info(`Setting "${key}": already present, left unchanged`);
  const { error } = await supabase.from("site_settings").insert({ key, value: await build(), is_public: true });
  check(error, `Creating setting ${key}`);
  ok(`Setting "${key}" created`);
}

await seedSetting("store", async () => ({
  // Contact details were not part of the brief. Set them in Admin → Settings.
  whatsapp_number: "",
  phone_display: "",
  email: "",
  instagram_url: "",
  address: "",
  business_hours: "",
  shipping_fee: 0,
  free_shipping_above: null,
}));

await seedSetting("homepage", async () => {
  const slides = [];
  for (const slide of heroSlides) slides.push({ image_path: await upload("homepage-images", slide.file), alt: slide.alt });
  return {
    hero: {
      eyebrow: "Handcrafted artisan candles",
      heading: "Light that lingers within.",
      subheading:
        "Candles handcrafted in wax with artistry, fragrance and understated elegance — made to make a space feel a little more special.",
      cta_label: "Shop Now",
      cta_href: "/shop",
      slides,
    },
    sections: { categories: true, bestsellers: true, collections: true, gallery: true, founders: true, testimonials: true },
  };
});

await seedSetting("about", async () => {
  const people = [];
  for (const f of founders) people.push({ name: f.name, image_path: await upload("founder-images", f.file) });
  return { story: foundersStory, founders: people };
});

// ── verify ───────────────────────────────────────────────────────────────
const counts = {};
for (const table of ["categories", "collections", "products", "product_variants", "product_option_values", "product_images", "site_settings"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  check(error, `Counting ${table}`);
  counts[table] = count;
}
console.log("\nDatabase now contains:", counts);
console.log("\nNext: set the WhatsApp number and contact details in Admin → Settings.");
