# (CLIENT OWN) paints — house painting company storefront

A full storefront for a paint company, running on the PostgreSQL schema in
[`schema.sql`](./schema.sql): colours, products, product variants, basket, orders and order
items — with constraint enforcement, foreign keys, row level security, RPC functions and a
SQL console, all live in the browser.

Everything the UI shows comes out of the six tables in that schema. There is no fixture
list in the front-end code: the shop, the colour library, the basket, the order history and
the admin reports are all rows.

```
index.html            page shell: header / footer / mounts the app, loads src/app.js
main.pjs              $meta (title, description, social image) + the kv-plugin import + shop settings
src/schema.sql        the database schema (run this first on a real Supabase project)
src/sql/functions.sql server-side functions + RLS policies + execute grants (run this second)
src/seed.sql          the catalogue seed for a real project (run this third; SQL twin of src/seed.js)
src/schema.js         JavaScript mirror of schema.sql: columns, defaults, checks, FKs, indexes, policies
src/sql.js            tiny SQL parser (select/insert/update/delete, where/order/limit/array literals)
src/db.js             the in-browser Postgres engine: insert/select/update/delete, RLS, cascades, EXPLAIN
src/pg-error.js       Postgres-flavoured errors (23502, 23503, 23505, 23514, 42501, 42P01 …)
src/persistence.js    storage adapters: kv-plugin (IndexedDB) with a localStorage fallback
src/auth.js           accounts: anonymous sign-in, PBKDF2-SHA256 passwords, guest-cart merge
src/seed.js           catalogue seed: 18 colours, 10 products, 143 variants, demo account + orders
src/store.js          service layer: every read/write the UI performs, plus auth session wiring
src/supabase.js       optional adapter that points the same UI at a real Supabase project
src/app.js            hash router + all views (home, shop, product, colour studio, basket, checkout,
                      orders, account, database console)
src/styles.css        design system
```

## Running it on your own machine

The source is an ordinary static site: no build step, no bundler, no install. Copy
`index.html` and the `src/` tree anywhere and serve that folder over HTTP (ES modules won't load
from `file://`):

```sh
python3 -m http.server 8080     # or: npx serve .
# open http://localhost:8080
```

Two things are perchance-only and simply switch themselves off outside perchance:

- **`main.pjs`** (`$meta` + the `store` settings block) is never read. `buildSettings()` falls back
  to the same values, so the shop looks identical; to change the shop name, currency, tax rate or
  delivery thresholds without perchance, define `window.spectrumSettings` before `src/app.js` loads
  (same keys as the `store` block), or edit the defaults in `src/store.js`.
- **`kv-plugin`** is absent, so `src/persistence.js` falls back to `localStorage`. The in-browser
  database, the session and the demo seed all work exactly as they do on perchance.

That gives you the whole storefront, with the "database" living in the browser. To own the
**database** as well, run Supabase's local stack (needs Docker) instead of a hosted project:

```sh
supabase init
supabase start                                   # PostgREST + GoTrue + Postgres in Docker
for f in src/schema.sql src/sql/functions.sql src/seed.sql; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$f"
done
```

Then set `enable_anonymous_sign_ins = true` under `[auth]` in `supabase/config.toml`,
`supabase stop && supabase start`, and paste `http://localhost:54321` plus the anon key from
`supabase status` into the Database page — the same panel and the same code path used for a hosted
project (self-hosted URLs are accepted). No Supabase account, no internet, nothing rented.

**Full self-hosting** (the backend on your own server, not just your laptop) is the same story one
level up. Supabase's [self-hosted stack](https://supabase.com/docs/guides/self-hosting/docker) is
Postgres + PostgREST + GoTrue + Kong behind one hostname, and this app reaches for nothing beyond
`/rest/v1` and `/auth/v1` — no Storage bucket, no Edge Function, no Realtime, no vendor-only
feature. So: run that compose stack, run the three SQL files against it, set
`enable_anonymous_sign_ins` in its env, and point the Database page at `https://your-domain`.
Reproducing the platform is now your job — TLS, backups, upgrades, the JWT secret that signs your
anon key — and that is the actual cost of self-hosting, not the app.

## Two backends, one API

`db.from("products").select("*").eq("paint_type", "Interior")` and
`db.rpc("place_order", { … })` are the only database APIs the UI uses. They are served either by
the in-browser engine (`src/db.js`, default) or by a real Supabase project (`src/supabase.js`).

### Going live on a real Supabase project

The Database page has a **Connect a real Supabase project** panel that does all of this from the
browser, and it tests the project before it commits to it (bad URL, wrong key, missing tables and
an unseeded catalogue each get their own message). The manual recipe is:

1. Create a project at supabase.com.
2. **SQL Editor** → run `src/schema.sql`, then `src/sql/functions.sql`, then `src/seed.sql`, in that
   order.
3. **Authentication → Sign In / Providers** → turn on **Anonymous sign-ins** (a first-time visitor
   needs one to get a basket, because `cart_items.user_id` is NOT NULL). Switch off *Confirm email*
   if you want the demo sign-up to log straight in.
4. Copy the **Project URL** and the **anon public key** from Project Settings → API into that panel.

`src/seed.sql` is the SQL twin of `src/seed.js`: the same 18 colours, 10 products and 143 variants,
written with deterministic UUIDs so it can be re-run to update the catalogue in place. The two
catalogues therefore agree row for row, including which colourways are out of stock (both derive
`stock_status` from the same FNV-hash of `product.title|color.name`).

### What differs between the two backends

| | in-browser engine | real Supabase project |
| --- | --- | --- |
| storage | kv-plugin (IndexedDB), per visitor | Postgres, shared by everyone |
| catalogue | seeded on first run from `src/seed.js` | `src/seed.sql`, run once in the SQL editor |
| demo orders | baked into the seed | `seed_demo_orders()` — writes only to `auth.uid()` |
| auth | local `users` table, PBKDF2 hashes | GoTrue (anonymous sign-in, email + password) |
| SQL console | full parser + planner | not available — the browser can't run raw SQL against PostgREST |
| service role | `db.asService()` bypasses RLS | impossible: the browser only ever holds the anon key, so RLS always applies |
| re-seeding / truncating | buttons on the Database page | run `src/seed.sql` in the SQL editor; deletes belong in the Supabase table editor |

Everything else — the router, the views, the SQL the app runs — is identical, because both
backends implement the same `from()` / `rpc()` / `info()` / `stats()` / `totalsFor()` surface. Two
compile-time-shaped differences are worth knowing when you edit the code:

- `place_order` returns the order **row** locally but `jsonb` (`order_id`, `subtotal`, `tax`,
  `shipping`, `total_amount`) from the SQL function; `store.js#placeOrder` normalises both into the
  row the checkout view routes to.
- `auth.users` has no PostgREST endpoint, so `from("users")` resolves to an empty result rather
  than a 404, and the Database console marks that table as not exposed.

## What the engine actually enforces

The local engine is not a stub — it rejects bad data the way Postgres does, and the UI shows the
raw error code and message in a toast or in the console panel:

| Try this in the console | Result |
| --- | --- |
| `insert into colors (name, hex_code, category) values ('Bad','red','Test');` | `23514` `colors_hex_code_format` |
| `insert into cart_items (user_id, variant_id, quantity, selected_size, selected_finish) values (…, 0, …);` | `23514` `cart_items_quantity_positive` |
| `insert into products (title, base_price, paint_type, size_options) values ('X', 10, 'Spray', '{}');` | `23514` `products_paint_type` |
| `delete from colors where name = 'Coastal Sage';` | `23503` `product_variants_color_id_fkey` (ON DELETE RESTRICT) |
| any write as the client session (RLS) | `42501` row-level security policy for table … |
| deleting your own account while you have orders | `23503` `orders_user_id_fkey` — order history always survives |

Also implemented: `gen_random_uuid()` / `now()` defaults, numeric rounding to 2dp, `text[]`
columns with `@>` containment, `on delete cascade` (products → variants → basket), unique indexes,
reverse *and* forward relation embedding in selects (`orders.select("*, order_items(*, product_variants(*, products(*), colors(*)))")`),
and a planner that shows `Index Scan using idx_cart_items_user_id` versus `Seq Scan`.

## Roles and accounts

`cart_items.user_id` is a NOT NULL foreign key into `auth.users`, so a basket needs a user. The
shop mirrors Supabase anonymous sign-in: a first-time visitor gets an anonymous `auth.users` row,
shops as themselves, and when they sign up or sign in the guest basket is folded into the
permanent account by the `merge_cart` function. Passwords are hashed with PBKDF2-SHA256 (120k
iterations) before they reach the users table.

Demo account (pre-filled on the account page): `demo@spectrumcoatings.co` / `spectrum123` — it owns
four seeded orders in different states and a two-line basket.

Against a real project none of that is emulated: accounts live in `auth.users` and are managed by
GoTrue, so anonymous sign-ins, email confirmation and password hashing are Supabase's job, not
`src/auth.js`'s. Signing up while holding a guest basket calls `merge_cart` with `p_to_user` equal
to `auth.uid()`, which is the only direction the function accepts. The four demo orders come from
`seed_demo_orders()`, which is `security definer` but always scoped to the caller — it can only
ever write your own rows, so it is safe to expose to `authenticated`.

The header button bottom-right opens the **SQL log**: every query the app runs, with role, row
count, timing and the equivalent SQL. It is the quickest way to see the front-end is really
talking to the tables. The **Database** page browses each table's columns, constraints, indexes and
policies, runs SQL as either the client session (RLS applies) or the service role, and shows
reports aggregated from the orders.

## Catalogue rules

- 18 colours (`src/seed.js`), each with hex, category, description, finish list, and a `usage`
  list deciding which paint systems it is mixed in. `usage` is a seeding rule, not a column — the
  `product_variants` table is the product × colour join it generates (143 rows).
- 10 products across `Interior`, `Exterior`, `Masonry`, each with base price and tin sizes.
- Line price = `products.base_price` × tin-size factor (`500ml … 10L`), rounded to 2dp, snapshotted
  into `order_items.unit_price` at checkout so history never changes retroactively.
- Totals: subtotal + sales tax (8.25%) + delivery (free over $75), computed by the
  `place_order` function, not by the browser.

## Assets

Product, hero and editorial photography is AI-generated and hosted on the platform CDN; the URLs
are in `IMAGES` (`src/seed.js`) and `$meta.image` (`main.pjs`). Swatches are pure CSS from
`colors.hex_code`. The tin "labels" are HTML/CSS overlays positioned over the photographs, so a
product's label always shows the selected colour.

## House rules for future work

- Keep the schema authoritative: if a column changes, change `schema.sql`, `schema.js` and the
  Supabase `functions.sql` together, then reset demo data from the Database page.
- `src/seed.sql` is generated from `src/seed.js` — the two must agree, so regenerate rather than
  hand-editing it (the generators live in `seed.js`; the SQL just carries the same rows and the
  same deterministic ids).
- The UI never reads fixture data — add rows, not hard-coded lists.
- `main.pjs` holds `$meta`, the `kv-plugin` import and the tweakable `store` settings block
  (name, currency, tax rate, delivery thresholds) that the whole UI reads at boot.
- Keep `src/supabase.js` implementing the same surface as `src/db.js`. When you add a method to the
  local engine that `store.js` calls, add it to the adapter too — the two backends are meant to be
  indistinguishable from the rest of the app.
