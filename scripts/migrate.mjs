// Applies the SQL files in supabase/migrations to your Supabase database, in
// order, each inside a transaction. Applied files are recorded in
// public.schema_migrations, so re-running is safe and does nothing new.
//
//   npm run db:migrate
//
// Needs SUPABASE_DB_URL in .env.local: Supabase → Connect → "Session pooler"
// (or "Direct connection") URI, with your database password filled in.
// This is an alternative to pasting the files into the SQL Editor.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { fail, info, ok } from "./_client.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  fail(
    "SUPABASE_DB_URL is not set.\n" +
      "Add it to .env.local (Supabase → Connect → Session pooler URI, including your database password),\n" +
      "or paste the files in supabase/migrations into the Supabase SQL Editor in order instead.",
  );
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

try {
  await client.connect();
} catch (error) {
  fail(`Could not connect to the database: ${error.message}\nCheck the password and that the URI is the Session pooler or Direct connection string.`);
}

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
    revoke all on public.schema_migrations from anon, authenticated;
  `);

  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select name from public.schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  // A database set up by pasting the SQL by hand has the tables but no record of it.
  if (applied.size === 0) {
    const { rows: existing } = await client.query("select to_regclass('public.products') is not null as present");
    if (existing[0].present) {
      await client.query("insert into public.schema_migrations (name) select unnest($1::text[])", [files]);
      ok("The schema already exists (applied by hand); recorded the migrations as applied.");
      files.length = 0;
    }
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      info(`${file}: already applied`);
      continue;
    }
    const sql = await readFile(join(DIR, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => {});
      fail(`${file} failed and was rolled back: ${error.message}`);
    }
    ok(`${file}: applied`);
    ran++;
  }

  // Make the API see the new tables immediately.
  await client.query("notify pgrst, 'reload schema'");
  console.log(ran ? `\n${ran} migration(s) applied.` : "\nNothing to do: the database is up to date.");
} finally {
  await client.end();
}
