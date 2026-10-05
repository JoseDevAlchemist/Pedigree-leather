# Setup — Supabase and the admin

Everything needed to get the admin panel working from a fresh clone. In order, because
each step depends on the one before it.

**Time: about ten minutes, most of it waiting for Supabase.**

---

## 1. Install

```bash
pnpm install
```

Adds `@supabase/supabase-js`, `@supabase/ssr`, `zod` and `server-only`. All four are in
`package.json`.

---

## 2. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

You need three values, all from **Dashboard → Project Settings**:

| Variable | Where it comes from | Reaches the browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Data API → Project URL | Yes — harmless, it is just a hostname |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API Keys → anon / publishable | Yes — harmless *because of RLS*, see below |
| `SUPABASE_SERVICE_ROLE_KEY` | API Keys → service_role | **No** |

Two things about these that are worth reading once:

**The anon key is safe in the browser.** It is not a secret. It identifies your project
and does nothing on its own; what it can do is decided entirely by the row-level
security policies in `001_initial.sql`, which let an anonymous visitor read active
products and nothing else. Every Supabase project in the world ships one.

**The service role key is a full database credential.** It bypasses RLS entirely — it
can read and write every row, including the ones the shop's policies hide. This project
references it in exactly one file, `lib/supabase/admin.ts`, which also imports
`server-only` so that any attempt to import it from a browser component fails the
build rather than leaking the key. **If it is ever exposed, rotate it immediately.**
There is no safe way to un-leak a key.

> `.env.local` is covered by `.env*` in `.gitignore`, and `.env.example` is negated
> back out, so the template is committed and your real values never are. Check with
> `git check-ignore .env.local` (should match) and `git check-ignore .env.example`
> (should not).

### 3. The admin allow-list

Add this to `.env.local` as well:

```
AUTH_EMAILS=you@example.com
```

Comma-separated. Every authenticated Supabase user is treated as an admin by the
database's RLS policy — the database has no concept of a staff role yet — so this list,
enforced in `lib/supabase/guards.ts`, is what actually decides who can edit the
catalogue. **Leaving it empty denies everyone**, including you, which is the safe
failure and the reason it fails that way round.

---

## 4. Run the migration

Two files, in order. Both are in `supabase/migrations/` and both are idempotent, so
running them twice is harmless.

### Option A — the SQL editor (no CLI needed)

1. Open the **Supabase Dashboard** → your project → **SQL Editor** → **New query**
2. Open `supabase/migrations/001_initial.sql`, copy all of it, paste, press **Run**
3. Same again with `supabase/migrations/002_storage.sql`

Expect two green "Success" messages. If you get an error, read it — the migrations use
`IF EXISTS` / `IF NOT EXISTS` throughout, so an error means something real, not a
re-run.

### Option B — the Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The project ref is the first part of your URL:
`https://kgjqzjambhchqzvwabkg.supabase.co` → `kgjqzjambhchqzvwabkg`.

`supabase db push` applies everything in `supabase/migrations/` in filename order.

### What you should have afterwards

Three tables with RLS enabled, five indexes, six policies, and a `product-images`
storage bucket. The quickest check is to run this in the SQL editor:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- products, product_colors, product_images
```

---

## 5. Seed the catalogue

Paste `supabase/seed.sql` into the SQL editor and run it. It inserts **12 products**
(6 bags, 6 shoes) with **38 colourways**, and no images — every product renders as the
colour block the shop already uses when there is no photography.

Safe to run repeatedly: every insert is `ON CONFLICT DO NOTHING`.

The file at the end returns two counts. If they read 6 and 6, and 38 colours, the seed
is right.

> `supabase/seed.sql` is generated from `lib/mock-data.ts`. If you change a product in
> the mock data, regenerate the seed rather than hand-editing it — otherwise the two
> drift and the cause of any disagreement is hard to find.

### Before this step the shop still works

`lib/api.ts` falls back to `lib/mock-data.ts` when Supabase has no `products` table,
and it says so in the server log rather than failing quietly. That fallback is
load-bearing until the migration runs: it is why the shop's front page does not go dark
while you set this up. Once the migration is applied, the next request reads from
Supabase automatically and the fallback stops being used. See
`ADMIN_INTEGRATION_TODO.md` for removing it.

---

## 6. Create your admin user

1. **Supabase Dashboard** → **Authentication** → **Users** → **Add user**
2. Enter an email and password, tick **Auto Confirm User**, and save
   - *Auto Confirm* matters. An unconfirmed user cannot sign in, and the login page
     will report "that email and password do not match an account" for a perfectly
     correct password — which is a confusing way to find that out.
3. Copy the email you used into `AUTH_EMAILS` in `.env.local`
4. Restart the dev server, then go to `/admin/login`

There is no sign-up anywhere in this project, which is deliberate: with an open
registration form, every account created would be an admin, because the database's
policy says "authenticated" and nothing narrower. Adding staff later means narrowing
that policy — see the allow-list note in `ADMIN_INTEGRATION_TODO.md`.

---

## 7. Run it

```bash
pnpm dev
```

- Shop: <http://localhost:3000>
- Admin: <http://localhost:3000/admin> (redirects to `/admin/login`)

---

## Verify the whole thing

1. `/admin` → you land on `/admin/login`
2. A wrong password → an inline message, no redirect
3. The right password → the dashboard, with counts
4. `/admin/products` → 12 rows; the chips filter; the search filters
5. Click a stock number, type a new one, click away → saved
6. Edit → change the price → save → back on the list, changed
7. Delete → a confirm dialog, and the row goes
8. New product → save it with no photographs → it appears in `/bags` or `/shoes`
9. Sign out → `/admin/login`, and the shop's navbar is nowhere to be seen

---

## Troubleshooting

**`products` does not exist / PGRST205**
The migration has not run. Check step 4. The shop is unaffected — it falls back to mock
data and logs why.

**Login says the credentials do not match**
Either the password is wrong or the user is not confirmed. Check **Authentication →
Users** for the green confirmed marker.

**Login says the address is not on the allow-list**
`AUTH_EMAILS` is missing that address. Note it fails *closed*: an empty list denies
everyone.

**"The storage policy rejected this upload"**
`002_storage.sql` has not run, or the session has expired. Check step 4 and sign in
again.

**Uploads fail with a 400 and a Postgres message**
The file is over 8 MB or is not a JPEG, PNG, WebP or AVIF. The message says which.

**A product does not appear on the shop after adding it**
It is probably not `active`, or it is not `featured` if you expected it in the rail.
Also check the server log for the fallback warning — if the table is missing, the shop
is still reading mock data and will not see anything you have added.

**Stale route types after adding a route**
`pnpm exec tsc --noEmit` can fail with `Cannot find module '../../app/...'` after a
file is added or moved, because Next regenerates those types on the next request. Touch
a route (`curl localhost:3000/`) or delete `.next/types`. This is Next's behaviour, not
a broken import.