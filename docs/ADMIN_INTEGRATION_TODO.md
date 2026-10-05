# Admin integration — future work

Written down so the next session does not have to re-derive it. Ordered by how much it
will hurt to leave alone, not by how easy it is.

Items marked **blocking** should not be left past launch.

---

## Blocking before launch

### Remove the mock-data fallback from `lib/api.ts`

**Why.** `lib/api.ts` reads Supabase first and falls back to `lib/mock-data.ts` when a
read fails. That fallback is why the shop survived the period before the migration was
run, and it is genuinely useful — but left in place forever it is a silent failure
mode: if the database goes away at 2am, the shop keeps serving twelve hard-coded
products instead of erroring, and nobody finds out until a customer tries to buy
something that is not really for sale.

**How.** In `lib/api.ts`, delete `readFromSupabase`'s `reportOnce` branches and have it
throw on error instead of returning `null`. Then delete the `?? mockProducts(...)` fall
back in each of the five exported functions and the `MOCK_PRODUCTS` import.

**When it is safe.** Once `001_initial.sql` is applied and the seed has been verified —
i.e. once `lib/api.ts` demonstrably reads from the database.

### Replace the placeholder contact details

`lib/contact.ts` has an invented phone number (`254700000000`), an invented email and
an invented address. They are well-formed, so they will not fail loudly — they will
quietly send real customers to nobody, from the footer and from a floating button on
every page.

**How.** A `settings` table with one row, edited from the Settings page. The workshop's
phone number is not a deploy-time secret and should not need a redeploy to change.

---

## Not blocking, but do them

### Rate-limit the login action

`loginAction` is a public endpoint that calls Supabase's auth server on every attempt.
Supabase has its own limits, so this is not urgent — but the error message currently
does not distinguish "too many attempts" from "wrong password" for an address that is
*not* on the allow-list, and the allow-list check makes an unbounded number of requests
to `signInWithPassword` on the way to refusing them.

**How.** A counter in a table or an Upstash Redis instance, keyed by IP and by email
address. Five attempts a minute is generous for a human.

### Narrow the RLS policies to staff roles

001 grants `FOR ALL TO authenticated USING (true)` on all three tables. Every
authenticated Supabase user can therefore write to the catalogue at the database level.
`lib/supabase/guards.ts` narrows this in the application, which is good defence but is
not the same thing: a leaked anon key plus a valid session would bypass the app entirely.

**How.** A `staff` table or a `role` column on the user, and policies that check it —
`EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())` in the `USING` clause. Then
`AUTH_EMAILS` becomes a convenience for the first user rather than the security model.

### Add an audit log

The dashboard's "Recent activity" panel is an honest empty state because there is no
activity to show. A person editing a price should be able to find out who did it, and
after a bad sale somebody will need to know whether the price was always that.

**How.** An `audit_log` table `(id, product_id, action, before jsonb, after jsonb,
actor, at)` written by the server actions in `lib/actions/products.ts` — the same
`guarded()` wrapper every write already goes through, so there is one place to add it.
Then the dashboard panel reads the last twenty rows.

### Bucket cleanup for orphaned uploads

Uploads are not transactional: a file lands in storage the moment it is chosen, before
Save is pressed. Abandoning the form leaves an orphaned object. It is harmless — an
unreferenced file cannot appear in the shop — but it costs storage.

**How.** A scheduled function listing objects under no referenced `image_url`, deleting
anything older than 24 hours. Once a database-level reference exists the file is in use.

---

## When checkout exists

Not this session. Not the next one, probably. Recorded here so the shape is known
before it is built.

### Orders

Needs more than a table:

- **A webhook, not a browser callback.** Paystack must tell the server that money
  arrived. A `success` URL in the browser is a suggestion.
- **Stock decrements on payment, not on checkout.** A shop that reserves stock for an
  abandoned basket sells things it does not have.
- **A status machine**, not a boolean. `pending → paid → fulfilled`, plus `refunded`
  and `cancelled`. Every transition is a fact somebody may need to reconstruct later,
  so the history is the record.
- **Prices are copied onto the order row.** Never read the product's current price when
  rendering an old order — it will have changed, and the customer will be charged a
  different number from the one they agreed to.

### Payments

Paystack, per `GEMINI.md`. The deferred part of this project, and it should stay
deferred until the catalogue is real: a shop that can take money for twelve placeholder
products is a worse position than a shop that has not launched.

---

## Possible later

### Move images off Supabase Storage

The bucket is capped at 8 MB per file and 1 GB free, which is roughly 350 product
photographs before the bill starts. For a shop that shoots five views per colourway, a
real catalogue is about 40 photographs — so this is not close to a limit yet.

If it arrives: Cloudinary is the better answer for a shop (it resizes, crops and
transcodes), R2 if the priority is cost and you will serve pre-sized images yourself.
Either way `lib/upload.ts` is the only file that changes, which is the point of having
it.

### Sort the featured rail

`getFeaturedProducts()` returns featured products in `created_at` order because
`featured = true` alone has no rank. Four products is fine. Twenty is not — the rail
would need a rank column, and the admin would need a drag handle.

### Pagination on the product list

Twelve products, and a filtered view of twelve is a scroll. The moment there are enough
that a person would page rather than scroll, this is where `limit`/`offset` go. The
filter chips already carry everything needed to page by.

### Realtime

Deliberately not enabled. The admin does not poll or subscribe; it refreshes after each
write, because the person doing the writing is the person who needs to see the result
and they are already looking at it. Live updates matter the day two people are editing
at once — one `ALTER PUBLICATION` away when that is true.