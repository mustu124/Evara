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

Apply the three migration files **in order**. Either:

- **SQL Editor (no extra setup):** in the Supabase dashboard open **SQL Editor** and run the full contents of each file in `supabase/migrations/`:
  1. `0001_schema.sql` — tables, the order function, all security policies
  2. `0002_storage.sql` — image buckets and their policies
  3. `0003_gst_sets_sale.sql` — GST, per-candle choices in sets, the sale badge;
  4. `0004_weight_shipping.sql` — product weights and shipping charged per kg; or
- **Command line:** add `SUPABASE_DB_URL` to `.env.local` (Supabase -> **Connect** -> *Session pooler* URI, with your database password) and run `npm run db:migrate`. It applies each file in a transaction, records what it applied, and is safe to re-run.

If the site shows "The database needs an update", migration 0003 or 0004 has not been run yet.

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
- There is no public admin sign-up. `db:admin` (which needs the secret key) is the only way to grant the admin role. A user created in the Supabase dashboard is **not** an admin until you run `npm run db:admin -- their@email.com`; deleting and re-creating a user removes the role again. To set a new password for an admin, run `npm run db:admin -- their@email.com --reset-password`. Afterwards, in **Supabase → Authentication → Sign In / Providers**, turn off *Allow new users to sign up*.

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
4. Review the four policy pages and edit them in **Admin → Policies** (see *Things to review* below).

---

## 3. Deploy to Vercel

1. Push this repository to GitHub (see the note on secrets below).
2. In Vercel: **Add New → Project**, import the repository. The framework is detected as Next.js; keep the default build settings.
3. Before the first deploy, open **Project Settings → Environment Variables** and add, for the Production (and Preview) environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) — mark as *Sensitive*
   - `NEXT_PUBLIC_SITE_URL` — your production URL, no trailing slash
4. Deploy. Changing a `NEXT_PUBLIC_*` variable later requires a redeploy.
5. Add your domain under **Project Settings → Domains**, then update `NEXT_PUBLIC_SITE_URL` to match and redeploy. Until this is your real address, the sitemap, canonical links and social-share links point at the wrong site.
6. After the first deploy, open the live site and run through the manual checklist in section 5.

No Vercel API keys or tokens are needed anywhere in this project.

**Before your first commit:** the `Website Requirements/` folder is git-ignored because its PDF contains account passwords. Keep it out of the repository. The photos the site needs are already copied to `supabase/seed-assets/`.

---

## 4. How it works

### Storefront

| Route | Purpose |
| --- | --- |
| `/` | Full-width hero, the main categories, bestsellers, collections, gallery, reviews |
| `/shop` | All products with a category bar, sorting and pagination; search opens from the header icon on every page |
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
- **Sets:** a pack of N candles carries N sets of choices, one per candle, so a Set of 4 can be four different designs, hues and scents. Each candle's choices are stored with the order line.
- **Sale badge:** `products.on_sale`, switched per product in the admin. Nothing shows the badge unless an administrator turns it on.
- **Inventory** is optional per product and counted in individual pieces (a Set of 2 uses 2). The seed leaves tracking off because no stock figures were supplied.

### Ordering and WhatsApp

1. The cart lives in the browser (`localStorage`) and holds only ids, quantities and display copies of names and prices.
2. The cart page re-prices everything from the database on every change, so it always shows current prices and flags items that have become unavailable.
3. On submit, the server validates the customer details and calls the `create_order()` database function using the secret key. That function **ignores any price or total sent by the browser**; it re-reads prices, checks that the product is published and not coming soon, that every option has exactly one available value, checks stock, applies the shipping setting, generates a reference such as `EV-261010-AB2CD`, and stores the order and its line items (with prices frozen at that moment) in one transaction.
4. The server builds the WhatsApp message from the stored order and returns `https://wa.me/<number>?text=<encoded message>`.
5. The site tries to open WhatsApp and always shows the order reference, an **Open WhatsApp** button and a **Copy message** fallback in case the pop-up is blocked.

Opening WhatsApp never changes the order. It stays **Pending / Unpaid** until an administrator updates it.

Stock is deducted when an order moves to *Confirmed* (or later) and returned if a confirmed order is cancelled.

### GST and shipping

- **Prices are GST-inclusive.** Tax is extracted from the price, never added on top, so the amount a customer pays does not depend on their state.
- **Rate:** a store default (Admin -> Settings, seeded as 5%) that any product can override (Admin -> Products -> GST). Nothing is hardcoded. **Confirm the correct rate for your products with an accountant before going live.**
- **Tax type:** the delivery state is compared with the seller's state (Admin -> Settings, seeded as Maharashtra). Same state: CGST + SGST. Any other state: IGST.
- **Arithmetic:** for each line, `tax = amount - amount / (1 + rate)`. Within the state, `CGST = SGST = round(tax / 2)` and `taxable = amount - CGST - SGST`; otherwise `IGST = round(tax)` and `taxable = amount - IGST`. The parts therefore always add back to the amount exactly.
  - ₹150 within Maharashtra at 5%: taxable ₹142.86, CGST ₹3.57, SGST ₹3.57, total ₹150.00.
  - ₹150 to Punjab at 5%: taxable ₹142.86, IGST ₹7.14, total ₹150.00.
  - The brief's examples show a taxable value of ₹142.85. That figure plus the tax comes to ₹149.99, so the site uses ₹142.86 to make the invoice add up to the ₹150 charged.
- **Shipping:** charged per kg of the order's total weight, rounded up to the next whole kg (600 g is charged as 1 kg, 1.2 kg as 2 kg), at ₹80 per kg within Maharashtra and ₹120 per kg to every other state (Admin -> Settings). Each product's weight (one candle with its container) is entered in Admin -> Products -> Specifications as "Total weight"; a Set of 2 counts twice that. It is never shown to customers. **A product without a weight cannot be ordered**, because its shipping cannot be worked out. The charge is GST-inclusive and taxed at the highest GST rate among the items in the order.
- **GSTIN:** optional at checkout. If entered it is checked for format and its check character, stored with the order and included in the WhatsApp message.
- **Stored with every order:** tax type, seller state, taxable value, CGST, SGST, IGST, the shipping tax rate, and per line the rate, taxable value and tax. The cart, the confirmation screen, the WhatsApp message and the admin order page all show these same stored figures.
- There is no PDF tax invoice. The admin order page shows the breakdown needed to raise one.

### Admin panel (`/admin`)

Overview · Orders · Products (details, pack sizes, options, specifications, images, collections, inventory; publish, archive, and permanent delete of archived products) · Categories · Collections · Inventory · Homepage (hero banners, section visibility, bestsellers, founders' story, reviews) · Policies (edit the Privacy Policy, Terms & Conditions, Shipping Policy and Cancellation Policy; each save sets that page's last-updated date) · Settings (WhatsApp number, contact details, shipping).

### Security

- **Row Level Security on every table.** The public can read only published products, active categories/collections, published reviews and public settings. Orders and customer details are readable only by administrators.
- **Administrator checks happen on the server and in the database**, not in the UI: the admin layout, every server action and the RLS policies each verify the role (stored in `profiles.role`, which users cannot change).
- **Orders can only be created by `create_order()`**, which the browser roles are not permitted to execute.
- **Abuse protection:** at most 5 orders per hour per client address (stored only as a hash) and per phone number, plus a honeypot field.
- **Uploads:** administrators only; file type is verified from the file's contents; 4 MB limit; random file names; buckets enforce their own size and MIME limits.
- The secret key is read only in server-only modules and maintenance scripts and is never sent to the browser.

---

## 5. Testing

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # 63 automated tests
npm run build       # production build
```

`npm test` needs no Supabase project. It runs the real migration files against an in-process Postgres and checks, among other things, that:

- the seeded catalog matches the brief (counts, every price, every coming-soon value);
- orders are priced from the database and ignore browser-supplied prices;
- coming-soon, unavailable, unpublished and out-of-stock items are refused;
- option selections are validated; historical prices survive later price changes;
- rate limiting works; stock is deducted on confirmation and restored on cancellation;
- anonymous and ordinary signed-in users cannot read orders, change the catalog, promote themselves or call `create_order()`, while administrators can do their job;
- each candle in a set keeps its own choices, and a set with any candle incomplete or unavailable is refused;
- GST is extracted from the price and always adds back to it, for both the intra-state and inter-state examples in the brief; shipping is charged once; rates are configurable; the GSTIN is optional;
- the WhatsApp message contains every required detail and is correctly URL-encoded.

### Manual checklist against your real Supabase project

1. Home, Shop, a product page and a category page show the seeded products and photos.
2. On *Daisy Bowl Jar Candle*, switching to **Set of 2** changes the price from ₹299 to ₹579 and shows **Candle 1** and **Candle 2**, each with its own hue and scent.
3. On *Fruit Shot Glass Candle*, **Orange** and **Green Apple** are labelled coming soon and cannot be selected.
4. Add two different hue/scent combinations: the cart shows two lines; refresh keeps them. The summary shows Shipping ₹100 once, and choosing the delivery state shows CGST + SGST (Maharashtra) or IGST (elsewhere).
5. Clear the WhatsApp number in Admin → Settings: the cart explains that ordering is unavailable. Set it again and reload.
6. Complete checkout: you see an order reference, WhatsApp opens with the full message, and the order appears in Admin → Orders as **Pending / Unpaid**.
7. In the admin, change a price and confirm the storefront updates; upload, reorder, replace and delete a product image; mark an order Confirmed and Paid.
8. Sign out and confirm `/admin` redirects to the login page.

---

## 6. Production-readiness checklist

Last audited on 10 October 2026 against a local **production build** (`next build` + `next start`) connected to the live Supabase project.

### Completed and tested

| Area | What was run | Result |
| --- | --- | --- |
| Build | `npm run build`, `npm run typecheck`, `npm run lint` | Pass, no warnings |
| Automated tests | `npm test` (database logic, access policies, validation, GST, WhatsApp message) | 63 of 63 pass |
| Supabase connectivity, schema, policies, GST and per-candle orders | `npm run db:verify` against the live project | 53 of 53 pass |
| Public routes and navigation | Browser crawl of the production build | 53 internal URLs return 200; all 37 required routes exist and are linked; unknown URLs return a real 404 |
| Product information and image mapping | Every product page compared with the brief | Name, description, every pack price and original price, every option value, coming-soon values disabled, specifications, photo count, and the right photo per option, for all 5 products |
| Product navigation | Clicking each product photo and card | Opens the matching product |
| Responsive layouts | 10 pages at 360, 390, 768, 1024 and 1440 px | No sideways scrolling; mobile menu works |
| SEO | 16 pages | Unique titles, descriptions, one h1, canonical URLs, social tags, favicon, product structured data, `robots.txt`, `sitemap.xml` (36 URLs), `noindex` on admin |
| Accessibility | axe-core (WCAG 2 A/AA) on 10 pages, desktop and phone | No violations after fixes; skip link, keyboard selection and visible focus work |
| Cart and pricing | Browser test on the production build (44 checks, 3 consecutive clean runs) | Separate lines per variant, merging, quantities, removal, totals, persistence across refresh and tabs |
| Stale and unavailable data | Same test | Browser-edited prices replaced; changed prices shown; unavailable options and insufficient stock block checkout; stock lost mid-checkout is refused by the server |
| Order creation and WhatsApp | Same test | Order stored pending and unpaid with a unique reference; `wa.me` link to the configured number, fully URL-encoded, with every required detail; opening WhatsApp leaves the order pending; blocked pop-up fallback and Copy message work; emulated phone works |
| Admin authentication and authorization | Browser test on the production build with temporary accounts (70 checks) | Signed-out and non-admin users cannot reach any admin page or change anything, even with a valid session or a direct database token; open admin forms submitted without an admin session change nothing |
| Product CRUD, inventory, storage uploads | Same test | Create, edit, publish, unpublish, archive, delete; pack sizes, options, specifications; image upload, reorder, replace, delete (files removed from storage; fake images rejected); stock tracking enforced on orders |
| Order status management | Same test | Search, filters, details, status and payment updates, cancel confirmation, revenue counted only when paid |
| Cache refresh after admin edits | Same test, on the cached production build | A newly published product, a price change, an unpublish, new categories and settings changes each appeared on the storefront immediately |
| Product page, sets, GST, shipping, GSTIN, sale badge (11 October 2026) | Browser test on the production build against the live database (59 checks) | Gallery arrows; description below specifications; Colour, Scent, Pack size, Quantity order; one set of choices per candle; shipping charged once; CGST + SGST or IGST by state; optional GSTIN; sale badge only where enabled; larger uncropped founders' photos; Instagram card when configured |
| Secrets | Scan of the production browser bundle and of every committed file | The secret key is in neither; `.env.local` and the brief folder are git-ignored |
| Dependencies | `npm audit --omit=dev` | 0 known vulnerabilities in what is deployed |

All test accounts, products, images and orders created by these tests were removed afterwards.

### Completed in the live Supabase project

- All three migrations applied; shipping ₹100, seller state Maharashtra and default GST 5% set; four public storage buckets created with size and type limits; catalog seeded (16 categories, 6 collections, 5 products, 16 pack sizes, 48 option values, 19 product photos).
- WhatsApp number set to 918369440340.
- One administrator account exists and has signed in successfully.

### Not tested

- **The Vercel deployment itself.** The site has not been deployed. Everything above ran on a local production build, not on Vercel's servers.
- **A real WhatsApp message.** The tests open the WhatsApp link but never press send, so receipt of an order on the business phone has not been confirmed.
- **Real phones and other browsers.** Phone checks used an emulated device in Microsoft Edge; Safari, iOS and Firefox were not tested.
- **`npm run db:migrate` against Supabase.** It was tested against a local Postgres-protocol server only; the live project was migrated through the SQL Editor.
- **Load and concurrency.** No performance or load testing was done.
- One of four checkout runs on the production build stopped at order creation for a reason that could not be reproduced in the three runs that followed.

### Manual steps still required

1. **Deploy:** import the repository in Vercel and add the four environment variables from section 3.
2. **Set `NEXT_PUBLIC_SITE_URL`** to the real domain in Vercel. It is `http://localhost:3000` locally, and the sitemap, canonical links and social-share links use it.
3. **Turn off public sign-ups** in Supabase → Authentication → Sign In / Providers. New sign-ups get no privileges either way.
4. **Send one real test order** from the deployed site and confirm the WhatsApp message arrives.
5. **Change the passwords** listed in the original requirements PDF, which stores them in plain text.

### Things to review

- **Policy pages** describe how this site works but are general and are not legal advice. Delivery timelines, refund terms and business details must be confirmed by Evara Studios. Edit them in Admin → Policies; "Original wording" restores the shipped text.
- **Bestsellers:** the brief did not say which products sell best, so all five are featured. Adjust in Admin → Homepage.
- **Collection and category photos** reuse the supplied candle photos as stand-ins. Eight of the nine main category cards have no photo. Replace or add them in Admin → Collections and Admin → Categories.
- **Collections are empty:** no products are assigned to any collection yet.
- **Founders' names** (Neehal, Tanishq) were taken from the photo file names.
- **Email and Instagram** were not supplied and are blank, so they are hidden on the site. Add the Instagram link in Admin -> Settings and the Contact page and footer show it.
- **GST rate:** 5% is the rate used in the brief's examples. Confirm it before going live.
- **Customer reviews:** none were supplied, so the section is hidden until genuine reviews are added in Admin → Homepage.
- **Hero photos** are portrait and 900 px wide, so they look soft in the full-width banner on large screens. Landscape photos of at least 1920 px will look sharper.
- **Development tooling** (the test runner and linter, not deployed) has open advisories reported by `npm audit`. They are pinned because newer versions need a newer Node.js than 22.12.

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
