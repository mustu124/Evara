# Evara Studios

*Light that lingers within.*

The storefront and admin panel for Evara Studios, an artisan candle brand. Customers browse the catalog, build a cart and send their order over WhatsApp; the team manages products, stock, orders and site content from a protected admin panel.

- **Framework:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage) with Row Level Security
- **Validation / forms:** Zod, React Hook Form
- **Hosting:** Vercel

There is no online payment gateway. An order placed on the site is a *pending, unpaid request*; it becomes confirmed or paid only when an administrator marks it so.

---

## 1. What you need

- Node.js 20.9 or newer (developed on 22) and npm
- A [Supabase](https://supabase.com) project (the free tier is enough)
- A [Vercel](https://vercel.com) account and a GitHub repository, for deployment

## 2. Set up Supabase

### 2.1 Create the database

Apply the two migration files **in order**. Either:

- **SQL Editor (no extra setup):** in the Supabase dashboard open **SQL Editor** and run the full contents of `supabase/migrations/0001_schema.sql` (tables, the order function, all security policies), then `supabase/migrations/0002_storage.sql` (image buckets and their policies); or
- **Command line:** add `SUPABASE_DB_URL` to `.env.local` (Supabase -> **Connect** -> *Session pooler* URI, with your database password) and run `npm run db:migrate`. It applies each file in a transaction, records what it applied, and is safe to re-run.

### 2.2 Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` from **Supabase → Project Settings → API**:

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable key (`sb_publishable_…`). On older projects use `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the anon key instead. |
| `SUPABASE_SECRET_KEY` | **server only** | Secret key (`sb_secret_…`). On older projects use `SUPABASE_SERVICE_ROLE_KEY`. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | SEO metadata, sitemap | e.g. `http://localhost:3000` locally, your real domain in production |
| `ORDER_RATE_LIMIT_SALT` | **server only** | Any long random string |
| `WHATSAPP_NUMBER` | **server only**, optional | Fallback only. The number is normally set in Admin → Settings. |

`.env.local` is git-ignored. Never commit real keys.

### 2.3 Install, create buckets, seed the catalog, create the admin

```bash
npm install
npm run db:storage                     # creates + verifies the 4 public image buckets
npm run db:seed                        # loads the catalog and uploads the supplied photos
npm run db:admin -- you@example.com    # creates the first administrator (asks for a password)
npm run db:verify                      # tests the live project and reports what passed
```

`db:verify` checks the real project end to end: buckets and upload rules, that every table exists, that the seeded catalog matches the brief price for price, that a visitor's key cannot read orders or change anything, and that an order is priced by the database. Its test image and test order are deleted again. Checks that cannot run yet are listed as `SKIP` with the step to complete.

- All three scripts are **idempotent**. `db:seed` never overwrites anything that already exists, so it is safe to re-run and will not undo edits made in the admin panel.
- `db:storage` is an alternative to the bucket-creation part of `0002_storage.sql`; running both is fine. The **policies** in `0002_storage.sql` are still required.
- There is no public admin sign-up. `db:admin` (which needs the secret key) is the only way to grant the admin role. Afterwards, in **Supabase → Authentication → Sign In / Providers**, turn off *Allow new users to sign up*.

**Manual bucket creation (only if you cannot run the script):** in Supabase → Storage create four **public** buckets named exactly `product-images`, `homepage-images`, `founder-images`, `collection-images`, each with a 5 MB file size limit and allowed MIME types `image/jpeg, image/png, image/webp, image/avif`. Then run `0002_storage.sql`.

### 2.4 Run it

```bash
npm run dev
```

Open <http://localhost:3000>. Sign in at <http://localhost:3000/admin/login>.

### 2.5 First things to do in the admin panel

1. **Settings → WhatsApp business number.** Until this is set, customers can fill their cart but cannot check out (the site says so rather than failing).
2. **Settings → contact details** (email, Instagram link, hours). Empty fields are simply hidden on the site.
3. **Homepage → Bestsellers.** The seed features all five launch products; choose your real bestsellers.
4. Review the four policy pages (see *Things to review* below).

---

## 3. Deploy to Vercel

1. Push this repository to GitHub (see the note on secrets below).
2. In Vercel: **Add New → Project**, import the repository. The framework is detected as Next.js; keep the default build settings.
3. Before the first deploy, open **Project Settings → Environment Variables** and add, for the Production (and Preview) environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) — mark as *Sensitive*
   - `NEXT_PUBLIC_SITE_URL` — your production URL, no trailing slash
   - `ORDER_RATE_LIMIT_SALT` — mark as *Sensitive*
4. Deploy. Changing a `NEXT_PUBLIC_*` variable later requires a redeploy.
5. Add your domain under **Project Settings → Domains**, then update `NEXT_PUBLIC_SITE_URL` to match and redeploy.

No Vercel API keys or tokens are needed anywhere in this project.

**Before your first commit:** the `Website Requirements/` folder is git-ignored because its PDF contains account passwords. Keep it out of the repository. The photos the site needs are already copied to `supabase/seed-assets/`.

---

## 4. How it works

### Storefront

| Route | Purpose |
| --- | --- |
| `/` | Full-width hero, categories, bestsellers, collections, gallery, reviews |
| `/shop` | All products with search, category / collection / availability filters, sorting, pagination |
| `/shop/[slug]` | Product page: gallery, pack size and option selectors, quantity, specifications, related products |
| `/categories/[slug]`, `/collections/[slug]`, `/collections` | Scoped listings |
| `/cart` | Cart, delivery details and WhatsApp hand-off |
| `/about`, `/contact` | Founders' story, contact details |
| `/privacy-policy`, `/terms`, `/shipping-policy`, `/cancellation-policy` | Policies |

All catalog content, prices, stock and site settings come from Supabase. Public pages are cached and regenerated every 5 minutes, and every admin change purges the cache so edits show up straight away.

### Catalog model

- **`product_variants`** are the price-bearing pack sizes (Single Piece, Set of 2, …), each with its own price, original price and availability.
- **`product_options` / `product_option_values`** are the non-price choices (Design, Hue, Scent). Each value can be marked unavailable or *coming soon*; such values are shown but cannot be selected or ordered.
- A customer picks one pack size plus one value for every option. Each distinct combination is its own cart line.
- **Inventory** is optional per product and counted in individual pieces (a Set of 2 uses 2). The seed leaves tracking off because no stock figures were supplied.

### Ordering and WhatsApp

1. The cart lives in the browser (`localStorage`) and holds only ids, quantities and display copies of names and prices.
2. The cart page re-prices everything from the database on every change, so it always shows current prices and flags items that have become unavailable.
3. On submit, the server validates the customer details and calls the `create_order()` database function using the secret key. That function **ignores any price or total sent by the browser**; it re-reads prices, checks that the product is published and not coming soon, that every option has exactly one available value, checks stock, applies the shipping setting, generates a reference such as `EV-261010-AB2CD`, and stores the order and its line items (with prices frozen at that moment) in one transaction.
4. The server builds the WhatsApp message from the stored order and returns `https://wa.me/<number>?text=<encoded message>`.
5. The site tries to open WhatsApp and always shows the order reference, an **Open WhatsApp** button and a **Copy message** fallback in case the pop-up is blocked.

Opening WhatsApp never changes the order. It stays **Pending / Unpaid** until an administrator updates it.

Stock is deducted when an order moves to *Confirmed* (or later) and returned if a confirmed order is cancelled.

### Admin panel (`/admin`)

Overview · Orders · Products (details, pack sizes, options, specifications, images, collections, inventory; publish, archive, and permanent delete of archived products) · Categories · Collections · Inventory · Homepage (hero banners, section visibility, bestsellers, founders' story, reviews) · Settings (WhatsApp number, contact details, shipping).

### Security

- **Row Level Security on every table.** The public can read only published products, active categories/collections, published reviews and public settings. Orders and customer details are readable only by administrators.
- **Administrator checks happen on the server and in the database**, not in the UI: the admin layout, every server action and the RLS policies each verify the role (stored in `profiles.role`, which users cannot change).
- **Orders can only be created by `create_order()`**, which the browser roles are not permitted to execute.
- **Abuse protection:** at most 5 orders per hour per client address (stored only as a salted hash) and per phone number, plus a honeypot field.
- **Uploads:** administrators only; file type is verified from the file's contents; 4 MB limit; random file names; buckets enforce their own size and MIME limits.
- The secret key is read only in server-only modules and maintenance scripts and is never sent to the browser.

---

## 5. Testing

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # 43 automated tests
npm run build       # production build
```

`npm test` needs no Supabase project. It runs the real migration files against an in-process Postgres and checks, among other things, that:

- the seeded catalog matches the brief (counts, every price, every coming-soon value);
- orders are priced from the database and ignore browser-supplied prices;
- coming-soon, unavailable, unpublished and out-of-stock items are refused;
- option selections are validated; historical prices survive later price changes;
- rate limiting works; stock is deducted on confirmation and restored on cancellation;
- anonymous and ordinary signed-in users cannot read orders, change the catalog, promote themselves or call `create_order()`, while administrators can do their job;
- the WhatsApp message contains every required detail and is correctly URL-encoded.

### Manual checklist against your real Supabase project

1. Home, Shop, a product page and a category page show the seeded products and photos.
2. On *Daisy Bowl Jar Candle*, switching to **Set of 2** changes the price from ₹299 to ₹579.
3. On *Fruit Shot Glass Candle*, **Orange** and **Green Apple** are labelled coming soon and cannot be selected.
4. Add two different hue/scent combinations: the cart shows two lines; refresh keeps them.
5. With no WhatsApp number set, the cart explains that ordering is unavailable. Set the number in Admin → Settings and reload.
6. Complete checkout: you see an order reference, WhatsApp opens with the full message, and the order appears in Admin → Orders as **Pending / Unpaid**.
7. In the admin, change a price and confirm the storefront updates; upload, reorder, replace and delete a product image; mark an order Confirmed and Paid.
8. Sign out and confirm `/admin` redirects to the login page.

---

## 6. Status

**Built and verified in this repository**

- Type check, lint and production build pass.
- 43 automated tests pass (database logic, security policies, validation, WhatsApp message).
- The storefront was exercised in a real browser (desktop and mobile widths) against a local stand-in backend running the real schema and seed data:
  - all 37 internal URLs reachable from the navigation return 200, and unknown products, categories and collections return a real 404;
  - clicking every product image and card (home, shop, category, related products, gallery) opens the matching product;
  - search, category / collection / availability filters, all sort orders and pagination fallbacks;
  - coming-soon categories and empty collections show honest empty states;
  - every pack size shows its own current and original price; coming-soon values are disabled; choosing a design or hue switches the photo;
  - cart: separate lines per combination, quantity changes, removal, persistence across refresh, and server re-pricing after tampering with stored prices;
  - checkout validation, order creation, the confirmation screen and the generated `wa.me` link opening WhatsApp;
  - skip link, mobile menu, and no horizontal overflow on mobile.

**Executed against the live Supabase project**

- Migrations applied (by the project owner, in the SQL Editor); all 13 tables exist.
- `npm run db:storage`: four public buckets, 5 MB limit, image-only MIME allow-list.
- `npm run db:seed`: 16 categories, 6 collections, 5 products, 16 pack sizes, 48 option values, 19 photos, 3 settings.
- `npm run db:verify`: 44 checks passed. Storage upload rules; every product compared with the brief; a visitor's key cannot read orders or change anything; a test order was priced by the database (ignoring a tampered price), stored as pending/unpaid, then deleted.
- Admin panel and access control, driven in a real browser with temporary accounts (70 checks passed, twice):
  - *Unauthenticated:* all admin pages redirect to login; no registration is offered; wrong passwords are rejected.
  - *Signed-in non-admin:* cannot sign in to the admin; with a genuine session cookie every admin page still redirects; with their token the database refuses reading orders, changing prices, creating/archiving/deleting products, updating orders or settings, self-promotion, uploads and deletes.
  - *Server actions:* an already-open admin form submitted with a non-admin session, or with no session, changes nothing.
  - *Administrator:* sign in/out; dashboard statistics and revenue; product create (with validation), edit, publish, unpublish, archive, permanent delete; pack sizes, sale price, colour option, specifications; image upload, reorder, replace, delete (files removed from storage; a fake image is rejected); inventory (stock shown on the storefront and enforced on orders); category and collection create/edit/delete; order search, filters, details, status and payment updates, cancel confirmation; hero text, section visibility, bestsellers, reviews; WhatsApp number and store settings. Each change was confirmed in the database and, where relevant, on the storefront.
  - All temporary users, products, images, orders and settings changes were removed afterwards.

- Cart and WhatsApp checkout, driven in a real browser against the live project (45 checks; 4 consecutive clean runs after one unexplained client-side miss in which no order request was sent):
  - *Cart:* empty state; separate lines per pack size and option combination; identical combinations merge; photos, options, line subtotals and grand total; quantity up/down; remove; persistence across refresh and across tabs.
  - *Stale data:* browser-edited prices are replaced by database prices; a price changed by the shop shows the new price and total; an option that became unavailable is flagged and blocks checkout; stock is counted in pieces across lines; stock that runs out between review and submit is refused by the server with the cart kept intact.
  - *Checkout:* field validation; order created as pending/unpaid with a unique reference; `https://wa.me/<number>?text=` link, fully URL-encoded (newlines, `&`, `#`, `+`, `%`, the rupee sign) and containing every required detail; opening WhatsApp twice leaves the order pending/unpaid; reference survives a refresh.
  - *Failure cases:* with no number configured the cart says so and disables checkout; with pop-ups blocked the customer gets a notice, a real link and a working Copy message button.
  - *Mobile (emulated Pixel 7):* no sideways scrolling; tapping Open WhatsApp goes to WhatsApp for the configured number.
  - The WhatsApp number for these runs was a placeholder supplied only to the local test server; nothing was written to the store settings. Test orders and temporary catalog tweaks were removed.

**Executed locally only**

- 43 automated tests of the migrations, order function, stock handling and access policies (`npm test`).
- `npm run db:migrate` (applied and idempotent against a local Postgres-protocol server; the live project was migrated through the SQL Editor instead).
- The storefront route and link sweep described above ran against a local stand-in backend.

**Not yet done: needs the project owner**

- Create your administrator: `npm run db:admin -- you@example.com`. No admin account exists in the live project.
- Set the WhatsApp number in Admin -> Settings; checkout stays disabled until then.
- Turn off public sign-ups in Supabase -> Authentication (new sign-ups get no privileges either way).
- Deployment to Vercel. *The site has not been deployed*, and cache purging after admin edits was observed only in development mode.

**Things to review**

- **Policy pages** were written to describe how this site actually works, but they are general and are not legal advice. Delivery timelines, refund terms and business details must be confirmed by Evara Studios.
- **Bestsellers:** the brief did not say which products sell best, so the seed features all five. Adjust in Admin → Homepage.
- **Founders' names** (Neehal, Tanishq) were taken from the photo file names. Edit them in Admin → Homepage if needed.
- **WhatsApp number, email and Instagram** were not supplied and are intentionally blank.
- **Customer reviews:** none were supplied, so the section is hidden until genuine reviews are added in Admin → Homepage.
- **Hero photos:** the hero is a full-width banner, as on the reference site. The supplied photos are portrait (9:16, 900 px wide), so on wide screens only the middle band shows and it is enlarged. Uploading landscape photos of at least 1920 px in Admin -> Homepage will look sharper.
- Only the five documented products are seeded. Other categories and all collections are seeded empty and show a "coming soon" or "to be unveiled" message.

## 7. Project layout

```
src/app/(store)/        storefront pages
src/app/admin/          admin pages and server actions
src/app/actions/        public server actions (cart review, place order)
src/components/         store/ and admin/ UI
src/lib/                data access, validation, cart, WhatsApp, auth, Supabase clients
src/proxy.ts            session refresh + sign-in redirect for /admin
supabase/migrations/    SQL schema, functions, RLS and storage policies
supabase/seed-assets/   supplied photography uploaded by the seed script
scripts/                migrate, storage setup, catalog seed, admin creation, live verification
tests/                  automated tests
```
