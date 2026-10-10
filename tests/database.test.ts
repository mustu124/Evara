/**
 * Runs the real migration files against an in-process Postgres (PGlite) with
 * minimal stand-ins for Supabase's auth/storage schemas and API roles, then
 * exercises order creation, stock handling and Row Level Security.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { categories, collections, products, slugify } from "../scripts/catalog-data.mjs";

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  -- Supabase grants broad default privileges to the API roles; RLS and explicit
  -- revokes in the migration are what must actually protect the data.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

type Role = "anon" | "authenticated" | "service_role";
let db: PGlite;
let adminId: string;
let shopperId: string;

const ids = { variant: new Map<string, string>(), value: new Map<string, string>(), product: new Map<string, string>() };
const variant = (product: string, label: string) => ids.variant.get(`${product}|${label}`)!;
const value = (product: string, option: string, val: string) => ids.value.get(`${product}|${option}|${val}`)!;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** Runs a callback as one of Supabase's API roles, optionally as a signed-in user. */
async function as<T>(role: Role, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** True when a statement is refused outright or silently touches no rows. */
async function blocked(sql: string): Promise<boolean> {
  try {
    const result = await db.query(sql);
    return (result.affectedRows ?? 0) === 0 && result.rows.length === 0;
  } catch {
    return true;
  }
}

const customer = (over: Record<string, string> = {}) => ({
  name: "Asha Rao", phone: "9876543210", email: "", address_line1: "12 Lake View Road", address_line2: "",
  city: "Pune", state: "Maharashtra", pincode: "411001", note: "", ...over,
});

type OrderResult = { ok: boolean; code?: string; message?: string; errors?: { index: number; code: string; message: string }[]; order?: { id: string; reference: string; subtotal: number; shipping_amount: number; total: number; items: Record<string, unknown>[] } };

let phoneCounter = 6000000000;
/** Places an order through the service role, as the application server does. */
async function createOrder(items: unknown[], opts: { phone?: string; hash?: string | null } = {}): Promise<OrderResult> {
  const phone = opts.phone ?? String(++phoneCounter);
  return as("service_role", null, async () => {
    const rows = await q<{ result: OrderResult }>("select public.create_order($1::jsonb, $2::jsonb, $3) as result", [
      JSON.stringify(customer({ phone })), JSON.stringify(items), opts.hash ?? null,
    ]);
    return rows[0].result;
  });
}

const daisy = (qty = 1, pack = "Single Piece") => ({
  variant_id: variant("Daisy Bowl Jar Candle", pack),
  option_value_ids: [value("Daisy Bowl Jar Candle", "Hue", "Blush Pink"), value("Daisy Bowl Jar Candle", "Scent", "Jasmine")],
  quantity: qty,
});
const fruit = (design: string, qty = 1, pack = "Single Piece") => ({
  variant_id: variant("Fruit Shot Glass Candle", pack),
  option_value_ids: [value("Fruit Shot Glass Candle", "Design", design)],
  quantity: qty,
});

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of ["0001_schema.sql", "0002_storage.sql"]) {
    await db.exec(readFileSync(join(__dirname, "..", "supabase", "migrations", file), "utf8"));
  }

  // Users: the trigger gives each a 'customer' profile; one is promoted the way create-admin.mjs does.
  [{ id: adminId }] = await q<{ id: string }>("insert into auth.users (email) values ('admin@example.com') returning id");
  [{ id: shopperId }] = await q<{ id: string }>("insert into auth.users (email) values ('shopper@example.com') returning id");
  await db.query("update public.profiles set role = 'admin' where id = $1", [adminId]);

  // Seed from the same catalog data the real seed script uses.
  const categoryIds = new Map<string, string>();
  for (const cat of categories as { name: string; comingSoon?: boolean; children?: { name: string; comingSoon?: boolean }[] }[]) {
    const [{ id }] = await q<{ id: string }>("insert into public.categories (name, slug, is_coming_soon) values ($1, $2, $3) returning id", [cat.name, slugify(cat.name), Boolean(cat.comingSoon)]);
    categoryIds.set(cat.name, id);
    for (const child of cat.children ?? []) {
      const [row] = await q<{ id: string }>("insert into public.categories (name, slug, parent_id, is_coming_soon) values ($1, $2, $3, $4) returning id", [child.name, slugify(child.name), id, Boolean(child.comingSoon)]);
      categoryIds.set(child.name, row.id);
    }
  }
  for (const name of collections) await db.query("insert into public.collections (name, slug) values ($1, $2)", [name, slugify(name)]);

  for (const p of products) {
    const [{ id: productId }] = await q<{ id: string }>(
      "insert into public.products (name, slug, description, category_id, status, specifications) values ($1, $2, $3, $4, 'published', $5::jsonb) returning id",
      [p.name, slugify(p.name), p.description, categoryIds.get(p.category), JSON.stringify(p.specifications)],
    );
    ids.product.set(p.name, productId);
    for (const [i, pack] of p.packs.entries()) {
      const [{ id }] = await q<{ id: string }>(
        "insert into public.product_variants (product_id, label, pack_quantity, price, compare_at_price, sort_order) values ($1, $2, $3, $4, $5, $6) returning id",
        [productId, pack.label, pack.pack, pack.price, pack.compareAt, i],
      );
      ids.variant.set(`${p.name}|${pack.label}`, id);
    }
    for (const [i, option] of p.options.entries()) {
      const [{ id: optionId }] = await q<{ id: string }>("insert into public.product_options (product_id, name, kind, sort_order) values ($1, $2, $3, $4) returning id", [productId, option.name, option.kind, i]);
      for (const [j, v] of option.values.entries()) {
        const val = typeof v === "string" ? v : v.value;
        const soon = typeof v !== "string" && Boolean(v.comingSoon);
        const [{ id }] = await q<{ id: string }>(
          "insert into public.product_option_values (option_id, value, is_coming_soon, is_available, sort_order) values ($1, $2, $3, $4, $5) returning id",
          [optionId, val, soon, !soon, j],
        );
        ids.value.set(`${p.name}|${option.name}|${val}`, id);
      }
    }
  }
});

describe("seeded catalog matches the brief", () => {
  it("has the documented structure", async () => {
    const [counts] = await q<Record<string, number>>(`select
      (select count(*)::int from public.categories) as categories,
      (select count(*)::int from public.categories where parent_id is not null) as subcategories,
      (select count(*)::int from public.categories where is_coming_soon) as coming_soon_categories,
      (select count(*)::int from public.collections) as collections,
      (select count(*)::int from public.products) as products`);
    expect(counts).toEqual({ categories: 16, subcategories: 7, coming_soon_categories: 5, collections: 6, products: 5 });
  });

  it("stores the documented prices", async () => {
    const rows = await q<{ name: string; label: string; price: string; compare_at_price: string }>(
      `select p.name, v.label, v.price, v.compare_at_price from public.product_variants v join public.products p on p.id = v.product_id order by p.name, v.sort_order`,
    );
    const priceOf = (name: string) => rows.filter((r) => r.name === name).map((r) => [r.label, Number(r.price), Number(r.compare_at_price)]);
    const bowl = [["Single Piece", 299, 350], ["Set of 2", 579, 680]];
    const shot = [["Single Piece", 150, 200], ["Set of 2", 285, 380], ["Set of 4", 555, 740], ["Set of 6", 810, 1080]];
    expect(priceOf("Daisy Bowl Jar Candle")).toEqual(bowl);
    expect(priceOf("Sunflower Bowl Jar Candle")).toEqual(bowl);
    expect(priceOf("Fruit Shot Glass Candle")).toEqual(shot);
    expect(priceOf("Velvet Shot Glass Candle")).toEqual(shot);
    expect(priceOf("Floral Shot Glass Candle")).toEqual(shot);
  });

  it("marks exactly the documented option values as coming soon", async () => {
    const rows = await q<{ value: string }>("select value from public.product_option_values where is_coming_soon order by value");
    expect(rows.map((r) => r.value)).toEqual(["Chocolate Perf", "Green Apple", "Gucci Flora", "Lotus", "Marigold", "Orange", "Plumeria"]);
  });
});

describe("create_order", () => {
  it("prices the order from the database and stores a pending, unpaid order", async () => {
    const result = await createOrder([daisy(1, "Set of 2"), fruit("Mango", 3)]);
    expect(result.ok).toBe(true);
    expect(Number(result.order!.subtotal)).toBe(579 + 3 * 150);
    expect(Number(result.order!.total)).toBe(1029);
    expect(result.order!.reference).toMatch(/^EV-\d{6}-[A-HJ-NP-Z2-9]{5}$/);

    const [order] = await q<{ status: string; payment_status: string; total: string; customer_phone: string }>("select status, payment_status, total, customer_phone from public.orders where id = $1", [result.order!.id]);
    expect(order.status).toBe("pending");
    expect(order.payment_status).toBe("unpaid");
    expect(Number(order.total)).toBe(1029);

    const items = await q<{ product_name: string; variant_label: string; unit_price: string; quantity: number; line_total: string; selected_options: { name: string; value: string }[] }>(
      "select product_name, variant_label, unit_price, quantity, line_total, selected_options from public.order_items where order_id = $1 order by line_total desc", [result.order!.id]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ product_name: "Daisy Bowl Jar Candle", variant_label: "Set of 2", quantity: 1 });
    expect(Number(items[0].unit_price)).toBe(579);
    expect(items[0].selected_options).toEqual([{ name: "Hue", value: "Blush Pink" }, { name: "Scent", value: "Jasmine" }]);
    expect(Number(items[1].line_total)).toBe(450);
  });

  it("ignores any price or total supplied by the caller", async () => {
    const result = await createOrder([{ ...fruit("Blueberry", 2, "Set of 6"), price: 1, unit_price: 1, line_total: 1, total: 1 }]);
    expect(result.ok).toBe(true);
    expect(Number(result.order!.total)).toBe(1620);
  });

  it("refuses coming-soon option values", async () => {
    const result = await createOrder([fruit("Orange")]);
    expect(result.ok).toBe(false);
    expect(result.errors![0]).toMatchObject({ index: 0, code: "unavailable" });
    expect(result.errors![0].message).toContain("Orange");
  });

  it("requires exactly one valid value for every option", async () => {
    const missing = await createOrder([{ variant_id: variant("Daisy Bowl Jar Candle", "Single Piece"), option_value_ids: [value("Daisy Bowl Jar Candle", "Hue", "Blush Pink")], quantity: 1 }]);
    expect(missing.errors![0].code).toBe("invalid_options");

    const twoHues = await createOrder([{ variant_id: variant("Daisy Bowl Jar Candle", "Single Piece"), option_value_ids: [value("Daisy Bowl Jar Candle", "Hue", "Blush Pink"), value("Daisy Bowl Jar Candle", "Hue", "Powder Blue")], quantity: 1 }]);
    expect(twoHues.errors![0].code).toBe("invalid_options");

    const foreign = await createOrder([{ variant_id: variant("Daisy Bowl Jar Candle", "Single Piece"), option_value_ids: [value("Daisy Bowl Jar Candle", "Hue", "Blush Pink"), value("Fruit Shot Glass Candle", "Design", "Mango")], quantity: 1 }]);
    expect(foreign.errors![0].code).toBe("invalid_options");
  });

  it("rejects bad quantities, unknown variants and empty carts without creating an order", async () => {
    const [{ count: before }] = await q<{ count: number }>("select count(*)::int as count from public.orders");
    expect((await createOrder([daisy(0)])).errors![0].code).toBe("invalid");
    expect((await createOrder([daisy(51)])).errors![0].code).toBe("invalid");
    expect((await createOrder([{ variant_id: "7f3c1e9a-2b4d-4c6e-8f10-123456789abc", option_value_ids: [], quantity: 1 }])).errors![0].code).toBe("not_found");
    expect((await createOrder([{ variant_id: "not-a-uuid", option_value_ids: [], quantity: 1 }])).errors![0].code).toBe("invalid");
    expect((await createOrder([])).code).toBe("invalid_cart");
    // One bad line blocks the whole order.
    expect((await createOrder([daisy(1), fruit("Green Apple")])).ok).toBe(false);
    const [{ count: after }] = await q<{ count: number }>("select count(*)::int as count from public.orders");
    expect(after).toBe(before);
  });

  it("refuses unpublished, coming-soon and unavailable products", async () => {
    const velvet = { variant_id: variant("Velvet Shot Glass Candle", "Single Piece"), option_value_ids: [value("Velvet Shot Glass Candle", "Design", "Coffee Latte")], quantity: 1 };
    const productId = ids.product.get("Velvet Shot Glass Candle");

    await db.query("update public.products set status = 'draft' where id = $1", [productId]);
    expect((await createOrder([velvet])).errors![0].code).toBe("not_found");

    await db.query("update public.products set status = 'published', is_coming_soon = true where id = $1", [productId]);
    expect((await createOrder([velvet])).errors![0].code).toBe("unavailable");

    await db.query("update public.products set is_coming_soon = false where id = $1", [productId]);
    await db.query("update public.product_variants set is_available = false where id = $1", [velvet.variant_id]);
    expect((await createOrder([velvet])).errors![0].code).toBe("unavailable");

    await db.query("update public.product_variants set is_available = true where id = $1", [velvet.variant_id]);
    expect((await createOrder([velvet])).ok).toBe(true);
  });

  it("keeps historical prices when the catalog changes later", async () => {
    const result = await createOrder([fruit("Strawberry", 1, "Set of 4")]);
    await db.query("update public.product_variants set price = 999, compare_at_price = 1200 where id = $1", [variant("Fruit Shot Glass Candle", "Set of 4")]);
    const [item] = await q<{ unit_price: string; line_total: string }>("select unit_price, line_total from public.order_items where order_id = $1", [result.order!.id]);
    expect(Number(item.unit_price)).toBe(555);
    expect(Number(item.line_total)).toBe(555);
    const [order] = await q<{ total: string }>("select total from public.orders where id = $1", [result.order!.id]);
    expect(Number(order.total)).toBe(555);
    await db.query("update public.product_variants set price = 555, compare_at_price = 740 where id = $1", [variant("Fruit Shot Glass Candle", "Set of 4")]);
  });

  it("applies the administrator's shipping settings", async () => {
    await db.query(`insert into public.site_settings (key, value) values ('store', '{"shipping_fee": 80, "free_shipping_above": 1000}')`);
    const small = await createOrder([daisy(1)]);
    expect(Number(small.order!.shipping_amount)).toBe(80);
    expect(Number(small.order!.total)).toBe(379);
    const large = await createOrder([daisy(2, "Set of 2")]);
    expect(Number(large.order!.shipping_amount)).toBe(0);
    expect(Number(large.order!.total)).toBe(1158);
    await db.query("delete from public.site_settings where key = 'store'");
  });

  it("rate-limits repeated orders from one client or phone number", async () => {
    for (let i = 0; i < 5; i++) expect((await createOrder([daisy(1)], { hash: "client-a" })).ok).toBe(true);
    expect((await createOrder([daisy(1)], { hash: "client-a" })).code).toBe("rate_limited");
    expect((await createOrder([daisy(1)], { hash: "client-b" })).ok).toBe(true);

    for (let i = 0; i < 5; i++) expect((await createOrder([daisy(1)], { phone: "9000000001" })).ok).toBe(true);
    expect((await createOrder([daisy(1)], { phone: "9000000001" })).code).toBe("rate_limited");
  });

  it("rejects invalid customer details at the database level", async () => {
    await expect(
      as("service_role", null, () => q("select public.create_order($1::jsonb, $2::jsonb, null)", [JSON.stringify(customer({ phone: "9111111111", pincode: "12" })), JSON.stringify([daisy(1)])])),
    ).rejects.toThrow();
  });
});

describe("inventory", () => {
  const sunflower = (qty: number, pack: string) => ({
    variant_id: variant("Sunflower Bowl Jar Candle", pack),
    option_value_ids: [value("Sunflower Bowl Jar Candle", "Hue", "Ivory"), value("Sunflower Bowl Jar Candle", "Scent", "White Musk")],
    quantity: qty,
  });
  const stock = async () => (await q<{ stock_quantity: number }>("select stock_quantity from public.products where id = $1", [ids.product.get("Sunflower Bowl Jar Candle")]))[0].stock_quantity;

  it("counts stock in pieces across all lines of an order", async () => {
    await db.query("update public.products set track_inventory = true, stock_quantity = 5 where id = $1", [ids.product.get("Sunflower Bowl Jar Candle")]);
    // 2 sets of 2 (4 pieces) + 2 singles = 6 pieces > 5 in stock
    const tooMany = await createOrder([sunflower(2, "Set of 2"), sunflower(2, "Single Piece")]);
    expect(tooMany.ok).toBe(false);
    expect(tooMany.errors![0]).toMatchObject({ index: 1, code: "out_of_stock" });
    expect((await createOrder([sunflower(2, "Set of 2"), sunflower(1, "Single Piece")])).ok).toBe(true);
  });

  it("deducts stock on confirmation, not on the customer's request, and restores it on cancellation", async () => {
    await db.query("update public.products set stock_quantity = 5 where id = $1", [ids.product.get("Sunflower Bowl Jar Candle")]);
    const result = await createOrder([sunflower(1, "Set of 2"), sunflower(1, "Single Piece")]);
    expect(await stock()).toBe(5);

    await db.query("update public.orders set status = 'confirmed' where id = $1", [result.order!.id]);
    expect(await stock()).toBe(2);
    await db.query("update public.orders set status = 'shipped' where id = $1", [result.order!.id]);
    expect(await stock()).toBe(2); // not deducted twice

    await db.query("update public.orders set status = 'cancelled' where id = $1", [result.order!.id]);
    expect(await stock()).toBe(5);
    await db.query("update public.orders set status = 'cancelled' where id = $1", [result.order!.id]);
    expect(await stock()).toBe(5); // not restored twice
  });
});

describe("Row Level Security", () => {
  it("lets the public read only published catalog data", async () => {
    await db.query("insert into public.products (name, slug, status) values ('Secret Draft', 'secret-draft', 'draft')");
    await db.query("insert into public.categories (name, slug, is_active) values ('Hidden', 'hidden', false)");
    await db.query("insert into public.testimonials (author_name, quote, is_published) values ('A', 'Lovely', true), ('B', 'Unpublished', false)");

    await as("anon", null, async () => {
      const visible = await q<{ slug: string }>("select slug from public.products");
      expect(visible).toHaveLength(5);
      expect(visible.map((p) => p.slug)).not.toContain("secret-draft");
      expect(await q("select 1 from public.categories where slug = 'hidden'")).toHaveLength(0);
      expect(await q("select 1 from public.product_variants")).toHaveLength(16);
      expect(await q("select 1 from public.testimonials")).toHaveLength(1);
    });
  });

  it("hides variants, options and images of unpublished products", async () => {
    const productId = ids.product.get("Floral Shot Glass Candle");
    await db.query("update public.products set status = 'draft' where id = $1", [productId]);
    await as("anon", null, async () => {
      expect(await q("select 1 from public.product_variants where product_id = $1", [productId])).toHaveLength(0);
      expect(await q("select 1 from public.product_options where product_id = $1", [productId])).toHaveLength(0);
      expect(await q("select 1 from public.product_option_values v join public.product_options o on o.id = v.option_id where o.product_id = $1", [productId])).toHaveLength(0);
    });
    await db.query("update public.products set status = 'published' where id = $1", [productId]);
  });

  it("never exposes orders or customer details to the public or to ordinary signed-in users", async () => {
    for (const [role, uid] of [["anon", null], ["authenticated", shopperId]] as const) {
      await as(role, uid, async () => {
        expect(await blocked("select * from public.orders")).toBe(true);
        expect(await blocked("select * from public.order_items")).toBe(true);
        expect(await blocked("update public.orders set payment_status = 'paid'")).toBe(true);
        expect(await blocked("delete from public.orders")).toBe(true);
        await expect(db.query("insert into public.orders (reference, customer_name, customer_phone, address_line1, city, state, pincode, subtotal, total) values ('X', 'Eve', '9876543210', 'Somewhere', 'Pune', 'MH', '411001', 0, 0)")).rejects.toThrow();
      });
    }
    const [{ paid }] = await q<{ paid: number }>("select count(*)::int as paid from public.orders where payment_status = 'paid'");
    expect(paid).toBe(0);
  });

  it("grants the anonymous role read-only access and nothing on private tables", async () => {
    const rows = await q<{ table_name: string; privilege_type: string }>(
      "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.privilege_type === "SELECT")).toBe(true);
    const tables = new Set(rows.map((r) => r.table_name));
    for (const t of ["orders", "order_items", "profiles"]) expect(tables.has(t)).toBe(false);
  });

  it("blocks the browser roles from calling create_order directly", async () => {
    for (const [role, uid] of [["anon", null], ["authenticated", shopperId], ["authenticated", adminId]] as const) {
      await as(role, uid, async () => {
        await expect(db.query("select public.create_order($1::jsonb, $2::jsonb, null)", [JSON.stringify(customer()), JSON.stringify([daisy(1)])])).rejects.toThrow(/permission denied/);
      });
    }
  });

  it("stops non-administrators from changing the catalog, settings or their own role", async () => {
    for (const [role, uid] of [["anon", null], ["authenticated", shopperId]] as const) {
      await as(role, uid, async () => {
        expect(await blocked("update public.product_variants set price = 1")).toBe(true);
        expect(await blocked("update public.products set status = 'archived'")).toBe(true);
        expect(await blocked("delete from public.categories")).toBe(true);
        expect(await blocked("select * from public.profiles where role = 'admin'")).toBe(true);
        await expect(db.query("insert into public.products (name, slug) values ('Hack', 'hack')")).rejects.toThrow();
        await expect(db.query("insert into public.site_settings (key, value) values ('store', '{}')")).rejects.toThrow();
        await expect(db.query("update public.profiles set role = 'admin'")).rejects.toThrow();
        await expect(db.query("select public.admin_dashboard_stats()")).rejects.toThrow();
      });
    }
    const [{ cheap }] = await q<{ cheap: number }>("select count(*)::int as cheap from public.product_variants where price = 1");
    expect(cheap).toBe(0);
    const [{ role }] = await q<{ role: string }>("select role from public.profiles where id = $1", [shopperId]);
    expect(role).toBe("customer");
  });

  it("gives new sign-ups a non-privileged profile visible only to themselves", async () => {
    await as("authenticated", shopperId, async () => {
      const rows = await q<{ id: string; role: string }>("select id, role from public.profiles");
      expect(rows).toEqual([{ id: shopperId, role: "customer" }]);
    });
  });

  it("lets an administrator manage the catalog and orders", async () => {
    await as("authenticated", adminId, async () => {
      expect((await q("select 1 from public.products where slug = 'secret-draft'")).length).toBe(1);
      expect((await db.query("update public.products set status = 'published' where slug = 'secret-draft'")).affectedRows).toBe(1);
      expect((await db.query("update public.products set status = 'archived' where slug = 'secret-draft'")).affectedRows).toBe(1);
      await db.query("insert into public.site_settings (key, value) values ('store', '{\"whatsapp_number\": \"919876543210\"}')");
      expect((await q("select 1 from public.orders")).length).toBeGreaterThan(0);

      const [{ id }] = await q<{ id: string }>("select id from public.orders where status = 'pending' limit 1");
      expect((await db.query("update public.orders set status = 'confirmed', payment_status = 'paid' where id = $1", [id])).affectedRows).toBe(1);

      const [{ stats }] = await q<{ stats: Record<string, number> }>("select public.admin_dashboard_stats() as stats");
      expect(stats.active_products).toBe(5);
      expect(Number(stats.paid_revenue)).toBeGreaterThan(0);
      expect(stats.total_orders).toBeGreaterThan(0);
    });
  });

  it("restricts storage writes to administrators", async () => {
    const insert = "insert into storage.objects (bucket_id, name) values ('product-images', 'x.jpg')";
    await as("anon", null, async () => { await expect(db.query(insert)).rejects.toThrow(); });
    await as("authenticated", shopperId, async () => { await expect(db.query(insert)).rejects.toThrow(); });
    await as("authenticated", adminId, async () => {
      await db.query(insert);
      expect((await db.query("delete from storage.objects where name = 'x.jpg'")).affectedRows).toBe(1);
      await expect(db.query("insert into storage.objects (bucket_id, name) values ('some-other-bucket', 'x.jpg')")).rejects.toThrow();
    });
    const buckets = await q<{ id: string; public: boolean }>("select id, public from storage.buckets order by id");
    expect(buckets.map((b) => b.id)).toEqual(["collection-images", "founder-images", "homepage-images", "product-images"]);
    expect(buckets.every((b) => b.public)).toBe(true);
  });
});
