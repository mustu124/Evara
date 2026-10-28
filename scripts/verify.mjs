// Tests the LIVE Supabase project and reports exactly what passed.
//
//   npm run db:verify
//
// It checks storage, the schema, the seeded catalog, the security policies
// (using the public key, as a browser would) and order creation. Anything it
// writes is temporary: test images and the test order are deleted again.
// Checks that cannot run yet (e.g. before the migrations) are reported as SKIP.
import { createClient } from "@supabase/supabase-js";
import { BUCKETS, fail, getServiceClient } from "./_client.mjs";
import { collections, categories, products, slugify } from "./catalog-data.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = getServiceClient();
if (!publicKey) fail("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
/** A client exactly like the one a visitor's browser gets: public key, no session. */
const anon = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });

const tally = { pass: 0, fail: 0, skip: 0 };
const section = (title) => console.log(`\n${title}`);
function report(status, label, detail = "") {
  tally[status]++;
  console.log(`  ${{ pass: "PASS", fail: "FAIL", skip: "SKIP" }[status]}  ${label}${detail ? `  (${detail})` : ""}`);
}
const expect = (condition, label, detail) => report(condition ? "pass" : "fail", label, condition ? "" : detail);

// A 1x1 PNG, used for upload tests.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const testPath = `verify/${Date.now()}.png`;

// ── Storage ──────────────────────────────────────────────────────────────
section("Storage buckets");
{
  const { data: buckets, error } = await service.storage.listBuckets();
  if (error) fail(`Could not reach Supabase Storage: ${error.message}`);
  for (const id of BUCKETS) {
    const b = buckets.find((x) => x.id === id);
    expect(Boolean(b?.public), `${id}: exists and is public-read`, b ? "bucket is private" : 'missing, run "npm run db:storage"');
  }
  const ready = BUCKETS.every((id) => buckets.some((x) => x.id === id));

  if (!ready) {
    report("skip", "upload, public read and write-protection checks", "buckets missing");
  } else {
    const bucket = "product-images";
    const up = await service.storage.from(bucket).upload(testPath, PNG, { contentType: "image/png" });
    expect(!up.error, "server (secret key) can upload an image", up.error?.message);

    const publicUrl = service.storage.from(bucket).getPublicUrl(testPath).data.publicUrl;
    const res = await fetch(publicUrl);
    expect(res.ok && (res.headers.get("content-type") ?? "").startsWith("image/"), "uploaded image is publicly readable by URL", `HTTP ${res.status}`);

    const anonUp = await anon.storage.from(bucket).upload(`verify/anon-${Date.now()}.png`, PNG, { contentType: "image/png" });
    expect(Boolean(anonUp.error), "a visitor (public key) cannot upload", "anonymous upload succeeded!");
    if (!anonUp.error) await service.storage.from(bucket).remove([anonUp.data.path]);

    const anonOverwrite = await anon.storage.from(bucket).upload(testPath, PNG, { contentType: "image/png", upsert: true });
    expect(Boolean(anonOverwrite.error), "a visitor cannot replace an existing image", "anonymous overwrite succeeded!");

    await anon.storage.from(bucket).remove([testPath]);
    const stillThere = await fetch(`${publicUrl}?t=${Date.now()}`);
    expect(stillThere.ok, "a visitor cannot delete an image", "image was deleted by an anonymous request!");

    const wrongType = await service.storage.from(bucket).upload(`verify/${Date.now()}.txt`, Buffer.from("not an image"), { contentType: "text/plain" });
    expect(Boolean(wrongType.error), "non-image files are rejected by the bucket", "a text file was accepted");
    if (!wrongType.error) await service.storage.from(bucket).remove([wrongType.data.path]);

    const tooBig = await service.storage.from(bucket).upload(`verify/${Date.now()}-big.png`, Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]), { contentType: "image/png" });
    expect(Boolean(tooBig.error), "files over 5 MB are rejected by the bucket", "an oversized file was accepted");
    if (!tooBig.error) await service.storage.from(bucket).remove([tooBig.data.path]);

    const del = await service.storage.from(bucket).remove([testPath]);
    expect(!del.error && del.data?.length === 1, "server can delete the test image (clean-up)", del.error?.message);
  }
}

// ── Schema ───────────────────────────────────────────────────────────────
section("Database schema");
// Columns added by supabase/migrations/0003_gst_sets_sale.sql and 0004_weight_shipping.sql.
const migration3 = !(await service.from("products").select("on_sale, gst_rate").limit(1)).error
  && !(await service.from("orders").select("tax_type, taxable_value, customer_gstin").limit(1)).error;
const migration4 = !(await service.from("products").select("weight_grams").limit(1)).error
  && !(await service.from("orders").select("total_weight_grams, shipping_weight_kg, shipping_rate_per_kg").limit(1)).error;

const TABLES = ["profiles", "categories", "collections", "products", "product_collections", "product_options", "product_option_values", "product_variants", "product_images", "orders", "order_items", "site_settings", "testimonials"];
const missing = [];
for (const table of TABLES) {
  const { error } = await service.from(table).select("*", { head: true, count: "exact" }).limit(1);
  // HEAD responses carry no error body, so confirm with a tiny GET when in doubt.
  const probe = error ? { error } : await service.from(table).select("*").limit(1);
  if (probe.error) missing.push(table);
}
expect(missing.length === 0, `all ${TABLES.length} tables exist`, `missing: ${missing.join(", ")}. Apply the migrations (npm run db:migrate, or the SQL Editor)`);
if (missing.length === 0) expect(migration3, "GST, per-candle sets and sale badge columns exist (migration 0003)", "run supabase/migrations/0003_gst_sets_sale.sql");
if (missing.length === 0) expect(migration4, "product weight and weight-based shipping columns exist (migration 0004)", "run supabase/migrations/0004_weight_shipping.sql");
const schemaReady = missing.length === 0 && migration3 && migration4;
let weightsEntered = false;

// ── Catalog ──────────────────────────────────────────────────────────────
section("Catalog (compared with Website Requirement List.pdf)");
let seeded = false;
if (!schemaReady) {
  report("skip", "catalog checks", "schema not applied yet");
} else {
  const { data: rows, error } = await service
    .from("products")
    .select("name, slug, status, description, specifications, variants:product_variants ( label, pack_quantity, price, compare_at_price ), options:product_options ( name, values:product_option_values ( value, is_coming_soon, is_available ) ), images:product_images ( storage_path )");
  if (error) fail(`Could not read products: ${error.message}`);
  seeded = rows.length > 0;
  if (!seeded) {
    report("skip", "catalog checks", 'no products yet, run "npm run db:seed"');
  } else {
    const flat = categories.flatMap((c) => [c, ...(c.children ?? [])]);
    const { data: cats } = await service.from("categories").select("slug, is_coming_soon");
    const { data: cols } = await service.from("collections").select("slug");
    expect(flat.every((c) => cats.some((x) => x.slug === slugify(c.name))), `all ${flat.length} categories from the brief exist`);
    expect(flat.filter((c) => c.comingSoon).every((c) => cats.find((x) => x.slug === slugify(c.name))?.is_coming_soon), "coming-soon categories are flagged");
    expect(collections.every((c) => cols.some((x) => x.slug === slugify(c))), `all ${collections.length} collections exist`);

    for (const p of products) {
      const row = rows.find((r) => r.slug === slugify(p.name));
      if (!row) {
        report("fail", `${p.name}: present`);
        continue;
      }
      const prices = p.packs.every((pack) => {
        const v = row.variants.find((x) => x.label === pack.label);
        return v && Number(v.price) === pack.price && Number(v.compare_at_price) === pack.compareAt && v.pack_quantity === pack.pack;
      });
      const options = p.options.every((o) => {
        const opt = row.options.find((x) => x.name === o.name);
        return opt && o.values.every((v) => {
          const name = typeof v === "string" ? v : v.value;
          const found = opt.values.find((x) => x.value === name);
          return found && found.is_coming_soon === (typeof v !== "string");
        });
      });
      const specs = JSON.stringify(row.specifications) === JSON.stringify(p.specifications);
      expect(prices && options && specs && row.description === p.description && row.images.length === p.images.length,
        `${p.name}: description, ${p.packs.length} prices, options, specifications and ${p.images.length} images match`,
        `prices:${prices} options:${options} specs:${specs} images:${row.images.length}/${p.images.length}`);
    }

    // Weights are not in the brief; an administrator enters them (Admin -> Products -> Specifications).
    const { data: weights } = await service.from("products").select("name, weight_grams").eq("status", "published");
    const noWeight = (weights ?? []).filter((w) => !w.weight_grams).map((w) => w.name);
    weightsEntered = noWeight.length === 0;
    if (weightsEntered) report("pass", "every published product has its total weight (used for shipping)");
    else report("skip", "product weights", `not entered yet for: ${noWeight.join(", ")}. Add them in Admin -> Products; until then those products cannot be ordered`);

    const sample = rows.flatMap((r) => r.images)[0]?.storage_path;
    if (sample) {
      const res = await fetch(`${url}/storage/v1/object/public/${sample}`);
      expect(res.ok, "a seeded product photo loads from Storage", `HTTP ${res.status}`);
    }
  }
}

// ── Security policies, as a visitor ──────────────────────────────────────
section("Security (requests made with the public key only)");
if (!schemaReady) {
  report("skip", "row-level security checks", "schema not applied yet");
} else {
  const nothing = (r) => Boolean(r.error) || (r.data ?? []).length === 0;

  const pub = await anon.from("products").select("slug, status");
  expect(!pub.error && pub.data.every((p) => p.status === "published"), "visitors can read products, and only published ones", pub.error?.message);
  if (seeded) expect(pub.data.length >= products.length, "visitors can see the seeded catalog", `${pub.data?.length ?? 0} visible`);

  expect(nothing(await anon.from("orders").select("*").limit(1)), "visitors cannot read orders");
  expect(nothing(await anon.from("order_items").select("*").limit(1)), "visitors cannot read order items");
  expect(nothing(await anon.from("profiles").select("*").limit(1)), "visitors cannot read user profiles");

  const ins = await anon.from("products").insert({ name: "Verify Intruder", slug: `verify-intruder-${Date.now()}` }).select();
  expect(nothing(ins), "visitors cannot create products");
  if (!nothing(ins)) await service.from("products").delete().eq("id", ins.data[0].id);

  expect(nothing(await anon.from("product_variants").update({ price: 1 }).gte("price", 0).select()), "visitors cannot change prices");
  expect(nothing(await anon.from("categories").delete().neq("slug", "").select()), "visitors cannot delete categories");
  expect(nothing(await anon.from("site_settings").upsert({ key: "store", value: {} }, { onConflict: "key" }).select()), "visitors cannot change site settings");
  expect(nothing(await anon.from("orders").update({ payment_status: "paid" }).neq("reference", "").select()), "visitors cannot mark orders as paid");

  const rpc = await anon.rpc("create_order", { p_customer: {}, p_items: [], p_client_hash: null });
  expect(Boolean(rpc.error), "visitors cannot call create_order() directly", "the public key was allowed to call create_order()");
  const stats = await anon.rpc("admin_dashboard_stats");
  expect(Boolean(stats.error), "visitors cannot read dashboard statistics");

  if (seeded) {
    const { count } = await service.from("product_variants").select("*", { count: "exact", head: true }).eq("price", 1);
    expect(!count, "no price was altered by the attempts above");
  }
}

// ── Orders ───────────────────────────────────────────────────────────────
section("Order creation (a temporary test order, deleted afterwards)");
const catalogComplete = seeded && tally.fail === 0;
if (!schemaReady || !catalogComplete || !weightsEntered) {
  report("skip", "order checks", !schemaReady ? "schema not applied yet" : !seeded ? "catalog not seeded yet" : !catalogComplete ? "catalog incomplete, fix the failures above first" : "product weights not entered yet");
} else {
  const { data: daisy } = await service
    .from("products")
    .select("id, variants:product_variants ( id, label, price ), options:product_options ( name, values:product_option_values ( id, value, is_coming_soon ) )")
    .eq("slug", "daisy-bowl-jar-candle")
    .single();
  const { data: fruit } = await service
    .from("products")
    .select("variants:product_variants ( id, label ), options:product_options ( values:product_option_values ( id, value, is_coming_soon ) )")
    .eq("slug", "fruit-shot-glass-candle")
    .single();

  const customer = { name: "Verification Test", phone: "9000000000", email: "", address_line1: "Test address, please ignore", address_line2: "", city: "Test", state: "Maharashtra", pincode: "400001", note: "Automated verification" };
  const setOf2 = daisy.variants.find((v) => v.label === "Set of 2");
  const picks = daisy.options.map((o) => o.values.find((v) => !v.is_coming_soon).id);
  const call = (items) => service.rpc("create_order", { p_customer: customer, p_items: items, p_client_hash: null });

  const soon = fruit.options[0].values.find((v) => v.is_coming_soon);
  const fruitSingle = fruit.variants.find((v) => v.label === "Single Piece");
  const refused = await call([{ variant_id: fruitSingle.id, units: [[soon.id]], quantity: 1 }]);
  expect(refused.data?.ok === false, `a coming-soon design ("${soon.value}") is refused`, JSON.stringify(refused.error ?? refused.data).slice(0, 120));

  const incomplete = await call([{ variant_id: setOf2.id, units: [picks, picks.slice(0, 1)], quantity: 1 }]);
  expect(incomplete.data?.ok === false, "a set with an incomplete second candle is refused");
  const oneCandle = await call([{ variant_id: setOf2.id, units: [picks], quantity: 1 }]);
  expect(oneCandle.data?.ok === false, "a Set of 2 with choices for only one candle is refused");

  // Candle 2 gets a different value for every option that has more than one available.
  const otherPicks = daisy.options.map((o) => (o.values.filter((v) => !v.is_coming_soon)[1] ?? o.values.find((v) => !v.is_coming_soon)).id);

  // The 1-rupee "price" is a deliberate tampering attempt that must be ignored.
  const placed = await call([{ variant_id: setOf2.id, units: [picks, otherPicks], quantity: 2, price: 1, unit_price: 1 }]);
  const order = placed.data?.order;
  expect(placed.data?.ok === true, "a valid order is created", JSON.stringify(placed.error ?? placed.data).slice(0, 160));
  if (order) {
    expect(Number(order.subtotal) === 2 * Number(setOf2.price), `the total is priced from the database (2 x ₹${Number(setOf2.price)} = ₹${Number(order.subtotal)}), ignoring the browser's ₹1`);
    const { data: saved } = await service.from("orders").select("status, payment_status, tax_type, taxable_value, cgst_amount, sgst_amount, igst_amount, shipping_amount, total, items:order_items ( unit_price, product_name, variant_label, selected_options, gst_rate, taxable_value, tax_amount, line_total )").eq("id", order.id).single();
    expect(saved.status === "pending" && saved.payment_status === "unpaid", "the order is stored as pending and unpaid");
    expect(saved.items.length === 1 && Number(saved.items[0].unit_price) === Number(setOf2.price) && saved.items[0].selected_options.length === 2 * daisy.options.length, "the line item stores its own price, name and chosen options");
    const candles = [1, 2].map((n) => saved.items[0].selected_options.filter((o) => o.unit === n).map((o) => o.value).join(" / "));
    expect(candles[0] !== candles[1] && candles.every(Boolean), `each candle in the set keeps its own choices (candle 1: ${candles[0]}; candle 2: ${candles[1]})`);
    const taxSum = Number(saved.taxable_value) + Number(saved.cgst_amount) + Number(saved.sgst_amount) + Number(saved.igst_amount);
    expect(saved.tax_type === "intra_state" && Number(saved.cgst_amount) === Number(saved.sgst_amount) && Number(saved.cgst_amount) > 0 && Number(saved.igst_amount) === 0,
      `a Maharashtra delivery is taxed as CGST ₹${saved.cgst_amount} + SGST ₹${saved.sgst_amount}`, JSON.stringify(saved.tax_type));
    expect(Math.abs(taxSum - Number(saved.total)) < 0.005, `taxable value + GST adds back up to the total exactly (₹${saved.taxable_value} + tax = ₹${saved.total}), so GST is not charged on top`);
    expect(Number(saved.total) === Number(order.subtotal) + Number(saved.shipping_amount), `shipping (₹${saved.shipping_amount}) is added once to the total`);
    const { data: shipped } = await service.from("orders").select("total_weight_grams, shipping_weight_kg, shipping_rate_per_kg, shipping_amount").eq("id", order.id).single();
    expect(shipped.shipping_weight_kg === Math.ceil(shipped.total_weight_grams / 1000) && Number(shipped.shipping_amount) === shipped.shipping_weight_kg * Number(shipped.shipping_rate_per_kg),
      `shipping is charged by weight (${shipped.total_weight_grams} g, charged as ${shipped.shipping_weight_kg} kg x ₹${shipped.shipping_rate_per_kg} = ₹${shipped.shipping_amount})`);

    const away = await service.rpc("create_order", { p_customer: { ...customer, state: "Punjab", gstin: "27aapfu0939f1zv" }, p_items: [{ variant_id: fruitSingle.id, units: [[fruit.options[0].values.find((v) => !v.is_coming_soon).id]], quantity: 1 }], p_client_hash: null });
    if (away.data?.order) {
      const { data: inter } = await service.from("orders").select("tax_type, igst_amount, cgst_amount, taxable_value, total, shipping_amount, customer_gstin").eq("id", away.data.order.id).single();
      expect(inter.tax_type === "inter_state" && Number(inter.igst_amount) > 0 && Number(inter.cgst_amount) === 0, `a Punjab delivery is taxed as IGST ₹${inter.igst_amount}`);
      expect(inter.customer_gstin === "27AAPFU0939F1ZV", "an optional GSTIN is stored with the order");
      await service.from("orders").delete().eq("id", away.data.order.id);
    } else {
      report("fail", "an inter-state order with a GSTIN is created", JSON.stringify(away.error ?? away.data).slice(0, 160));
    }
    expect(/^EV-\d{6}-[A-Z2-9]{5}$/.test(order.reference), `the order has a reference (${order.reference})`);
    expect(((await anon.from("orders").select("id").eq("id", order.id)).data ?? []).length === 0, "a visitor cannot read that order, even knowing its id");

    const { error: delError } = await service.from("orders").delete().eq("id", order.id);
    const { count } = await service.from("order_items").select("*", { count: "exact", head: true }).eq("order_id", order.id);
    expect(!delError && !count, "the test order and its items were deleted (clean-up)", delError?.message);
  }
}

// ── Administrator ────────────────────────────────────────────────────────
section("Administrator");
if (!schemaReady) {
  report("skip", "administrator check", "schema not applied yet");
} else {
  const { count } = await service.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin");
  if (count) report("pass", `${count} administrator account(s) exist`);
  else report("skip", "no administrator yet", 'run "npm run db:admin -- you@example.com"');
}

console.log(`\n${tally.pass} passed, ${tally.fail} failed, ${tally.skip} skipped.`);
if (tally.skip) console.log("Skipped checks did not run. Complete the step named beside each one, then run this again.");
process.exit(tally.fail ? 1 : 0);
