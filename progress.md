# Pedigree Leather — build progress

Log of what has been built and verified. Newest session at the bottom.
The developer commits; no git commits are made here.

## Current Verified State

_(updated at the end of each session)_

- Next.js 16.3.8 (App Router, Turbopack), React 19.2, TypeScript strict, Tailwind CSS v4, pnpm.
- Design tokens live in `app/globals.css` only. Components must use token classes
  (`bg-primary`, `text-accent`, `bg-card`, `border-border`, `text-muted`); no raw hex in components.
- `<Navbar />` is mounted in `app/layout.tsx` and renders on every route. Nav items are Home, Bags,
  Shoes (disabled "Soon"), Contact. There is no About page or link.
- Favicon resolves from `app/icon.png` (generated from `Pedigree logo.jpeg`).
- `/` is a four-section landing page (hero, featured rail, new arrivals, bags/shoes split).
  `/shoes` is a "coming soon" stub. `/bags` is a headingless shop grid and `/bags/[slug]` is a real
  product page. All six product pages are prerendered (`generateStaticParams`), so every route is
  static.
- `Product` carries `featured: boolean` and `createdAt: string` (ISO). `lib/api.ts` exposes
  `getFeaturedProducts()` (curated) and `getNewArrivals(limit)` (sorted by `createdAt` desc).
- Cart state lives in `lib/store/cart.ts` (Zustand, persisted to localStorage under
  `pedigree-cart`) and survives a reload.
- `pnpm build` and `pnpm lint` pass (one pre-existing `<img>` warning in the cart drawer).
- **Session 3 was verified in a real browser** — 79 automated checks at 375 / 640 / 768 / 1024 /
  1440px, plus frame-by-frame sampling of the card → detail morph. Session 2's unverified list is
  now closed except the `prefers-reduced-motion` pass.
- **Session 4 was verified in a real browser** — 87 automated checks, all passing, plus the
  `prefers-reduced-motion` pass that sessions 2 and 3 left open. The hybrid hover roll, the mobile
  in-view roll, the footer, the 404 and the skeletons are all confirmed working, not just building.
- **`<Footer />` and `<WhatsAppButton />` are mounted in `app/layout.tsx`**, so both render on every
  route including the 404. `body` is a flex column and every page's `<main>` is `flex-1`, which is
  what puts the footer at the bottom of the viewport on short pages and below the fold on long ones.
- Shoes are live. `/shoes` and `/shoes/[slug]` are real routes and the home page's shoes column is a
  real grid — session 3's "coming soon" stub was replaced this session, because it had started
  contradicting the nav and the footer.
- **Contact details live in `lib/contact.ts` and nav items in `lib/navigation.ts`.** Both are read by
  the navbar, the footer, the contact page and the floating WhatsApp button, so the phone number in
  the footer and the number the button texts cannot drift apart. `lib/contact.ts` contains invented
  placeholder details, flagged in the file.
- **Builds must use `--webpack` on this machine.** `pnpm build` (Turbopack) fails in
  `next/font/google` with `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` and
  `next/font/google queries have exactly one entry`, across repeated attempts. Google Fonts is
  reachable from both curl and node fetch, and `next dev` is unaffected, so this is a Turbopack font
  resolution fault rather than a network one. `pnpm exec next build --webpack` produces an identical
  route table and a working site. Worth retrying plain `pnpm build` once the toolchain moves.

## Design decisions worth remembering

- `app/favicon.ico` (the create-next-app default) was deleted so it cannot compete with
  `app/icon.png` in the browser tab.
- `public/pedigree-logo.png` is a circular badge with transparent corners, derived from the
  source JPEG. Regenerate with the commands in the session log if the logo file changes.
- Light-only palette on purpose: the previous `prefers-color-scheme: dark` block was removed
  because a cream page with a brown bar is the brand, not a dark theme.
- `GEMINI.md` estimates the brand brown as `#7F4F28`; this session's brief pins
  `--pedigree-brown: #5D4037`. The brief wins, and the value lives in one place
  (`app/globals.css`) so it is a one-line change either way.
- The card → detail morph is **hand-rolled and measured**, not a stock `layoutId` animation. React
  unmounts the old page and mounts the new one in the same commit, and Motion's `unmount()` calls
  `NodeStack.remove(this)`, so by the time the detail page's projection node registers there is no
  previous node to inherit a snapshot from. `components/motion/SharedImageTransition.tsx` does the
  next best thing: the card measures its image rect at click time, the detail page measures itself
  in a layout effect and animates the difference with a compositor-only `transform`.
- **`layoutId` was removed from the product image entirely in session 3, and the `LayoutGroup` went
  with it.** Session 2 left a note saying `layoutId` was "still set on both ends … it is the right
  mechanism". It cannot work, and it actively *broke* the home page. Inside one projection tree, two
  elements sharing a `layoutId` are the *same* shared-layout element, and Motion paints all but one
  of them at `opacity: 0`. On `/bags` no product appears twice so nothing showed, but `/` renders
  the four featured products and then all six again, and **eight of the fourteen cards came out as
  blank cream blocks with perfectly correct computed styles**. The colour was not missing from the
  DOM; it was missing from the paint. A product appearing in two sections is not an edge case to
  engineer around — it is how the home page is meant to work, and `capture()` is keyed by product id
  so two cards for the same bag each morph from their own on-screen rect. Before adding a `layoutId`
  to a product image, read the header of `components/motion/SharedImageTransition.tsx`.
- Colour names and prices are the only user-facing strings; nothing about a product is
  hardcoded in a component. `lib/api.ts` is the single read path — components must never
  import `lib/mock-data.ts`.
- Added two files in session 2 beyond the brief: `lib/angles.ts` (angle order, labels, and the
  step/clamp helpers shared by the card's arrow keys, the swiper arrows and the dots) and
  `lib/color.ts` (placeholder fill maths; also decides whether a colour name should be
  `text-foreground` or `text-background`, which matters because the grid holds both cream
  `#EFE3D2` and black `#1C1C1C` swatches).
- Stock is **per product, not per colour** (`Product.stockQuantity`). `GEMINI.md` asked for
  per-colour stock; the session 2 brief simplified it. If per-colour stock is wanted later,
  add `stockQuantity` to `ColorVariant` — the sold-out UI already reads one number.
- **The card has two densities in one component.** Under `sm` the grid is two-up, so the card drops
  its description and puts the swatches under the price; from `sm` up it is the roomier card. There is
  no `isMobile` flag: the split is CSS (`hidden` / `sm:line-clamp-2`), and every piece of the mobile
  card is a responsive class rather than a JS media query.
- **Price and swatches share one `flex-wrap` row on the card, and the row wraps as a unit.** Letting
  flex wrap *inside* the price broke figures across lines (`KES` / `14,850` / `KES` / `16,500`) on any
  254px card holding a discounted price and four swatches. `PriceRow` also grew a `stacked` prop so
  the struck-through base price sits under the current one by design rather than by accident.
- `sm:block` silently defeats `sm:line-clamp-2` — `line-clamp` sets `display: -webkit-box`
  itself, and a sibling `block` in the same variant wins the cascade. This cost an hour of "why is the
  card six lines tall". Do not add a display utility next to a line-clamp.
- `scroll-pl-*` must match the `px-*` bleed on a scroll-snap rail. Without it, a snapped card aligns
  to the scroller's border box and lands 16px left of where the same card sits at rest.
- `ProductGrid` grew an optional `columns` prop. The home page's bags preview sits in half a page, and
  the responsive shop grid was trying to fit four cards in a 528px column and crushing all of them.
- The bags/shoes split is stacked until `lg`, not `md`: two columns at 768px leave each preview card
  about 146px, too narrow for a name and a price on one line.
- The sold-out scrim is `bg-charcoal/25`, not `bg-card/70`. The cream version bleached every colourway
  to the same pale grey, which read as a photograph that had failed to load. The card also stops
  rendering a discount badge when the product is sold out — the price is not actionable, and under
  the scrim the badge was a muddy patch.
- The nav's Shoes item is still a disabled "Soon" span even though `/shoes` now exists as a stub. The
  stub is a notice, not a shop. Flip `comingSoon` when there is something to buy.
- Added `zustand` in session 2 (the brief required it) even though `GEMINI.md` says not to add major
  dependencies without asking. Flagging it here so the next session knows it was a deliberate,
  brief-driven exception.
- **There is no `loading.tsx` anywhere, and adding one at a segment level breaks `notFound()` on
  that segment's children.** This cost the most time this session and the failure mode is silent.
  `app/bags/loading.tsx` rendered the skeletons exactly as intended — and silently turned every bad
  product URL into **HTTP 200 with the page permanently stuck on "Loading bags…"**. A segment's
  loading file wraps *every route beneath it*, `/bags/[slug]` included, so the `notFound()` thrown in
  the slug page was caught by that Suspense boundary and answered with the fallback shell. `/shoes`
  had no `loading.tsx` and 404ed correctly, so the two routes had byte-identical logic and opposite
  behaviour. The skeletons now live in a `<Suspense>` **inside** `app/bags/page.tsx`, which scopes
  the boundary to that page and leaves `/bags/[slug]` alone. **If you ever add a `loading.tsx`,
  check the status code of a bad child URL, not just that the skeleton renders.**
- The hybrid hover roll measures the cursor against the **image well, not the card** (`surfaceRef`),
  because a card is taller than its square picture: measuring the card put the bottom third of the
  photo in the middle band and showed the front view when it should have shown the back. The zone
  helper resolves a *named view* against the product's own `angles` with a fallback chain, so a shoe
  showing its sole and a bag showing its back panel are the same gesture resolved per product.
- **Roll trigger is `useHasHover()` (`hover: hover` and `pointer: fine`), not `min-width: 768px`.**
  A narrow desktop window has hover; a touch laptop has hover *and* a touchscreen. Viewport width is
  the wrong question, and it is also a hydration hazard — a media query cannot be answered on the
  server, so the roll hooks start inert and settle on the second render.
- Motion's `useReducedMotion()` returns `false` on the server and flips on hydration, so the skeleton
  pulse is CSS inside a `prefers-reduced-motion: no-preference` query rather than a JS check. A
  `useReducedMotion()` branch would start the animation anyway, one frame late.
- `--whatsapp-green` is the only non-Pedigree colour token and it is deliberately quarantined to the
  two WhatsApp surfaces. A shop green adopted anywhere else would stop reading as "this opens
  WhatsApp".
- The home page's bags/shoes split needed `flex h-full flex-col` on both columns with `mt-auto` on
  the links. The two grids have different content heights, so without it the "Shop bags" and
  "Shop shoes" links landed 50px apart at 1440 and read as a bug rather than as two columns.
  `ProductGrid` grew a `className` prop for this.

## Roadmap

1. Tokens, fonts, layout, Navbar — **done (session 1)**
2. Data model (`lib/types.ts`), sample data, `lib/api.ts` data-access seam — **done (session 2)**
3. Angle viewer + colour switching — **done (session 2)**
4. Shop grid: product cards, discount badge, stock status — **done (session 2)**
5. Cart — **done (session 2)**
6. Grid breakpoints + compact mobile card, About removed, home page — **done (session 3)**
7. Hybrid hover image-roll, footer, empty/loading states, WhatsApp button — **done (session 4)**
8. Shoes category — **done (session 4)**. `/shoes` grid and detail page are live.
9. Checkout · 10. Supabase · 11. Admin · 12. Paystack · 13. Polish

---

## Session log

### Session 1 — 2026-10-04 — Design tokens + Navbar

**Status:** started.

### Session 2 — 2026-10-04 — Product grid, product detail page, cart

**Status:** code complete and building. **Not verified in a browser** — the browser tool
reported no connected browser for the whole session. Do not treat the UI as signed off.

**What was built**

- Data layer: `lib/types.ts`, `lib/mock-data.ts` (6 bags), `lib/api.ts`, `lib/format.ts`,
  `lib/store/cart.ts`, plus `lib/angles.ts` and `lib/color.ts`.
- Grid: `components/product/ProductGrid.tsx`, `ProductCard.tsx`, and the shared pieces —
  `ProductImage.tsx`, `AngleDots.tsx`, `ColorSwatches.tsx`, `PriceRow.tsx`.
- Product page: `app/bags/[slug]/page.tsx` (server, fetches by slug, 404s a bad slug),
  `components/product/ProductDetail.tsx`, `AngleSwiper.tsx`, `AddToCartButton.tsx`.
- Cart: `components/cart/CartDrawer.tsx`, `CartIcon.tsx`, `CartDrawerProvider.tsx`.
- `components/ui/QuantityStepper.tsx`, shared by the product page and the drawer.
- Tokens added to `app/globals.css`: `--pedigree-shadow-card`, `--pedigree-shadow-card-lift`,
  `--pedigree-shadow-inset-hairline` (exposed as `shadow-card` / `shadow-card-lift`). The brief
  asked for `shadow-sm`; Tailwind's neutral `shadow-sm` is grey and reads as dirt on a cream
  page, so the card uses warm layered shadows instead — same subtlety, on-brand.
- `app/layout.tsx` now mounts `SharedImageTransitionProvider` and `CartDrawerProvider` around
  `<Navbar />` and the page, so both survive navigation.

**Verified**

- `pnpm build` passes. `/bags` is static; `/bags/[slug]` prerenders all six products.
- `pnpm lint` passes with one intentional warning: the cart line thumbnail uses a plain
  `<img>`. That branch is dead code today because every `images` value is `null`; switch it
  to `next/image` when real photography lands.

**Not verified — the whole session 2 checklist**

- Grid at 375 / 768 / 1440px, and the column counts at each breakpoint.
- Card contents: placeholder, 5 dots, swatches, name, clamped description, discount price.
- Swatch click changing the placeholder colour; arrow keys changing angle on a focused card.
- The card → detail morph. This is the highest-risk item: it is a hand-rolled FLIP, not a
  stock `layoutId` animation (see the design notes above), so it needs watching at 10% speed.
- Angle swiper drag/arrows/dots, quantity stepper, Add to Cart.
- Cart badge pop, drawer open/close, item add/remove/quantity, subtotal, same product in two
  colours as two lines, cart surviving a reload, sold-out behaviour on both card and page,
  Escape and backdrop close.
- `prefers-reduced-motion` on the swiper, drawer and morph.

**Next session, first job:** connect a browser and run that list before building anything new.

### Session 3 — 2026-10-04 — Grid breakpoints, About removed, home page

**Status:** code complete, building, and **verified in a real browser**.

The desktop browser tool reported no connected browser for the whole session (same as session 2),
so verification was done with headless Chromium (Playwright, installed in `/tmp`, nothing added to
the repo) driving the dev server: 61 layout/interaction checks across `/`, `/bags`, `/shoes`,
`/about`, plus 18 link/carousel checks and 2 frame-by-frame morph checks.

**What was built**

- `lib/types.ts`: `Product` gained `featured: boolean` and `createdAt: string` (ISO).
- `lib/mock-data.ts`: six bags now carry hard-coded `createdAt` values spread over the 30 days
  before 2026-10-04, and four are `featured: true`. The hard-coding is deliberate — a mock that
  re-dates itself from `Date.now()` makes the ordering untestable and shifts prerendered HTML
  between builds. The sold-out Rift Valley Backpack is deliberately *not* featured; a featured rail
  should never spend a slot on something a shopper cannot buy. Prices, colours, descriptions and
  the `null` images are untouched.
- `lib/api.ts`: added `getFeaturedProducts()` and `getNewArrivals(limit)`, each `async` with a
  commented future-fetch shape. `getProducts()` now actually sorts newest-first, which its doc
  comment claimed it did. Sorting compares `Date.parse`, not strings, so a `+03:00` offset sorts
  correctly against `Z`. Home uses three separate calls rather than one fat `getHomePageData()`
  because featured and new-arrivals will cache differently once there is a real API.
- `components/product/ProductGrid.tsx`: `grid-cols-2` under `sm` (was `grid-cols-1`), `sm:2`,
  `md:3`, `lg:4`; gap `gap-3` on mobile and `gap-6` from `sm`. Optional `columns` prop for a grid
  that already sits inside a narrow column.
- `components/product/ProductCard.tsx`: compact under `sm` (no description, `px-3` padding, `text-base`
  name, 16px swatch dots), full card from `sm` up. Accepts a `className` so the featured rail can
  size its cards without a second component.
- `components/product/ColorSwatches.tsx`: the `sm` dot is now `size-4 sm:size-5`; the 32px hit area
  is unchanged (below 24px fails WCAG's target minimum). The group got `flex-wrap` so a future
  five-colourway product cannot overflow a card.
- `components/product/PriceRow.tsx`: the `card` size is now responsive (`text-sm sm:text-base`), and a
  `stacked` prop puts the struck-through base price on its own line.
- `app/bags/page.tsx`: heading and paragraph removed; the grid sits directly under the navbar
  (`px-4 pt-6`, `sm:px-6 sm:pt-8`, `lg:px-8`).
- `app/about/` deleted; the About entry removed from `NAV_ITEMS`, which is the single array both the
  desktop nav and the mobile drawer read, so one edit covered both. Grepped the repo: no `/about`
  reference remains in code.
- `app/page.tsx`: rebuilt as four sections — hero, featured rail, new arrivals, bags/shoes split.
  Carries the long comment the brief asked for about why featured is curated and new arrivals is
  automatic, and why there is no cron and no daily shuffle.
- `app/shoes/page.tsx`: new coming-soon stub with the `stitch` rule, so the route is a real page
  instead of a 404. No product grid, no fake placeholders.
- `app/globals.css`: added a `scrollbar-none` utility (Firefox `scrollbar-width`, WebKit
  `::-webkit-scrollbar`), used by the featured rail only.
- `components/motion/SharedImageTransition.tsx`, `ProductCard.tsx`, `ProductDetail.tsx`: the
  `layoutId` removal described under design decisions above.

**Verified — every item on the session's checklist**

- `/bags` at 375 / 768 / 1440: 2 / 3 / 4 columns, `scrollWidth === innerWidth` at every width (no
  horizontal overflow), no `h1` in `main`, and the grid's top edge 24px below the navbar's bottom edge
  (32px from `sm`). Nothing spills outside its card at 375 / 640 / 768 / 1024 / 1440.
- Compact card at 375: description `display: none`, swatch dot exactly 16px, swatch group 104px
  inside a 142px content box, longest name ("Kilimanjaro Weekender") wraps to two lines without
  overflowing, and no `KES` figure occupies more than one line box at any width.
- Navbar: no About link in the desktop nav, the mobile drawer, or anywhere else in the document.
  `/about` returns 404.
- Home at 375: hero 389px tall (compact, not a viewport hero), four sections, featured rail with four
  products, `overflow-x: auto` + `scroll-snap-type: x mandatory`, new arrivals 2-up, bags preview 2-up,
  bags/shoes split stacked, no overflow. Same page at 768 and 1440 with nothing broken; at 1440 the
  four featured cards share the new-arrivals grid's exact column lines (176 / 454 / 732 / 1010).
- Featured rail: `tabindex=0`, `scrollbar-width: none`, scrolls on ArrowRight from the keyboard, and
  the snapped card lands on the 16px padding edge rather than 16px left of it.
- Navigation and transition: clicking a card from the featured rail, from new arrivals and from
  `/bags` all lands on `/bags/[slug]` with the right `h1`. Sampling the image rect every animation
  frame across the navigation shows the morph still running — the card's width grows smoothly
  (495 → 545 → 567 → 581 → 589 → 592) to the settled detail size, starting at exactly the clicked
  card's width. Both the `/bags` card and the featured-rail card morph from their own on-screen rect.
- A swatch click recolours the card (`rgb(74,28,28)` → `rgb(28,28,28)`) and does not navigate.
- Cart end to end: Add to Cart opens the drawer with "Karura Tote / Cognac / KES 18,500", and the
  badge still reads 1 after a reload.
- Every internal link on the home page returns 200: `/`, `/bags`, `/contact`, `/shoes`, and all six
  product slugs. The hero's "Shop shoes" reaches `/shoes`.
- `pnpm build` passes and prerenders 13 static pages; `/about` is gone from the route list.

**Errors found and fixed while verifying**

1. **Blank product blocks on the home page** — duplicate `layoutId`s (see design decisions). This was
   the big one: it looked like missing data and was actually Motion hiding the duplicates.
2. **Descriptions six lines tall from `sm` up** — `sm:block` was overriding `sm:line-clamp-2`.
3. **`KES 14,850` split across three lines** on 254px cards with four swatches. Fixed by making the
   price/swatch row wrap as a unit and by stacking the base price deliberately.
4. **Bags preview crushed to 88px cards** in the half-width split column. Fixed with the pinned
   `columns={2}`, and the split moved from `md` to `lg`.
5. **Snapped carousel cards landed 16px off** their resting position. Fixed with `scroll-pl-*`.
6. **Stale generated route types** — `.next/types/validator.ts` still referenced the deleted
   `app/about/page.tsx` and `tsc --noEmit` failed. Removing `.next/types` and letting the dev server
   regenerate them fixed it. Expect this after deleting any route.
7. A missing `grid` class in the new `ProductGrid` class map made every grid collapse to a stack for
   one build. Caught by the column-count assertions before it went any further.

**Not verified**

- `prefers-reduced-motion` across the new home page sections. Nothing new animates (the rail is CSS
  scroll-snap, not Motion), but the reduced-motion pass from session 2 is still outstanding for the
  drawer, the swiper and the morph.
- A real touch drag on the featured rail — verified with keyboard scrolling only.
- The five `AngleSwiper` angles per product are unchanged from session 2 and still only spot-checked.

**Next session, first job:** the reduced-motion pass, then admin — `featured` and `createdAt` are the
two columns the home page reads, and `getFeaturedProducts()` / `getNewArrivals()` are already shaped
for them. Shoes after that.

---

### Session 4 — 2026-10-05 — Hybrid hover roll, footer, empty/loading states, WhatsApp button

**Status:** code complete, building, and **verified in a real browser**. 87 automated checks, 0
failures, against a production build.

The desktop browser tool reported no connected browser again (third session running), so
verification was headless Chromium (Playwright installed in `/tmp`, nothing added to the repo).
Scripts live in `/tmp/opencode/verify/`: `lib.js` (the 87-check suite), `hybrid.js`, `mobile.js`,
`split.js`, `probe404.js`, `rm.js`, `console.js`.

**Picked up from:** session 4's first half was already written and on disk — the three hooks
(`useHoverAngleRoll`, `useInViewAutoRoll`, `useMediaQuery`) and the `ProductCard` integration, all
untracked in git and absent from `progress.md`. Also on disk and unrecorded: the whole shoes
category (`Product.category`, `lib/category.ts`, `app/shoes/[slug]/`, six shoes in the mock data).
This session's work is the footer, the empty/loading/404 states, the WhatsApp button, and finishing
and verifying the roll.

**What was built**

- `components/layout/Footer.tsx` — charcoal, three columns from `md`, stacked below. Brand +
  tagline, nav from `lib/navigation`, contact from `lib/contact` with phone/email/address icons and a
  WhatsApp button. Bottom bar with copyright and an editable credit line, divided by the brand's
  `stitch` rule rather than a second invented decoration.
- `components/layout/Brand.tsx` — `BrandMark` and `Wordmark` extracted out of `Navbar.tsx`. Both the
  navbar and the footer open with the wordmark, and two copies of the one piece of brand typography
  that must be identical everywhere is a drift waiting to happen. `Wordmark` deliberately carries no
  size class, because two size utilities for the same breakpoint in one class string resolve by
  stylesheet order rather than by intent.
- `lib/navigation.ts`, `lib/contact.ts` — the nav list and the contact details, each read by several
  components. See the design notes on drift.
- `components/ui/Skeleton.tsx` — pulsing block. CSS-driven, not Motion.
- `components/product/ProductCardSkeleton.tsx` — a skeleton that is the card's layout, not generic
  bars: square image, five dots, name, description, price, four swatches, both densities. `count`
  defaults to 8.
- `app/bags/page.tsx` — rewritten around a `<Suspense>` boundary with `ProductGridSkeleton` as the
  fallback. Read the design notes before adding a `loading.tsx`.
- `app/not-found.tsx` — compass mark, "We couldn't find that page", Browse bags (primary) and Back
  home. `main#main` so the navbar's skip link works on the one page where a keyboard user most wants
  it.
- `components/layout/WhatsAppButton.tsx` — 56px circle, `z-40` (above content, below the navbar and
  the drawer), spring in once, hover scale 1.05, press 0.92. Hidden on `/admin`.
- `app/globals.css` — `--whatsapp-green` + `--color-whatsapp`, and the `skeleton-pulse` utility with
  its keyframes.
- `components/cart/CartDrawer.tsx` — empty state gained an icon, a heading and a filled primary
  button. It had the message and a link but read as an unfinished panel.
- `app/contact/page.tsx` — built out against `lib/contact`. It previously said "Phone, WhatsApp and
  shop hours go here", which invited someone to type the phone number directly into the markup and
  then let the footer disagree with it. Shop hours were **not** invented: a made-up opening hours on
  a real shop's contact page is worse than an honest gap.
- `app/page.tsx` — the shoes column's "our first pairs are on the bench" stub is now a real grid and
  a live "Shop shoes" link. It was directly contradicting the nav, the footer and `/shoes`.
- `components/product/ProductGrid.tsx` — exports `gridColumnsClass()` (so the skeleton and the real
  grid cannot end up on different column counts) and takes a `className`.

**Verified — all 87 checks**

- Footer on `/`, `/bags`, `/shoes`, `/contact`, a product page and a 404 page; three columns at
  1440, stacked full-width at 375, no horizontal overflow at 375; computed background is exactly
  `rgb(43,43,43)` and text `rgb(245,233,217)`; copyright, credit line, tagline, phone, email and
  address all present; every nav link 200; the WhatsApp href carries `254700000000` and a
  percent-encoded `?text=`.
- WhatsApp button: 56×56 at both 1440 and 375, bottom-right inside the viewport, `position: fixed`,
  `background-color: rgb(37,211,102)`, `target=_blank`, `rel~=noopener`, an accessible name, scales on
  hover, and present on every non-`/admin` route.
- Hybrid roll at 1440, pointer parked in each zone: left→side-left, right→side-right, centre-column
  top→top, centre-column bottom→back, dead centre→front. Timed roll takes over when the pointer is
  still (2+ unprompted changes in 6s). 2s of continuous movement inside the left third holds
  side-left — the roll does not leak. Leaving resets to front.
- Mobile at 375 (touch, coarse pointer, no hover): scroll-in plays `FRONT → SIDE L → SIDE R → TOP →
  BACK → FRONT` and settles on front; it replays identically after leaving and re-entering the
  viewport; sweeping the pointer through all four zones does nothing; desktop does not auto-roll.
- `prefers-reduced-motion: reduce` at 1440: front view held through 3s parked and through a
  six-position sweep — no timed roll and no pointer-driven roll. The skeleton animation is absent.
- Cart end to end: empty drawer shows the icon, "Your cart is empty" and a 44px+ "Browse bags";
  Add to Cart confirms, the drawer shows the product and price, the badge is non-zero, and it
  survives a reload.
- No unexpected console errors on any route.

**Errors found and fixed while verifying**

1. **`app/bags/loading.tsx` turned every bad product URL into a 200 with a stuck skeleton.** The
   big one. Full explanation in the design notes. This is the single most important thing to read
   before touching loading states in this repo.
2. **The home page's shoes column was a lie.** A "shoes aren't ready yet" panel sitting above a
   footer link and a nav item that both said shoes were on sale. Replaced with the real grid.
3. **The bags/shoes split links were 50px apart** at 1440 once both sides became real grids.
   `flex h-full flex-col` + `mt-auto` on the link wrappers; `ProductGrid` took a `className`.
4. **`pnpm build` (Turbopack) fails on `next/font/google`**, repeatedly and with a network that
   demonstrably works. `next build --webpack` is the workaround for now; not caused by any change
   here, and it needs watching.
5. The dev-only "n/5" indicator is compiled out of a production build, which initially made the
   angle look unreadable in prod verification. Read the placeholder's stamped label instead, and
   check the indicator separately against the dev server (it does work: `1/5 front` → `2/5
   side-left` → `3/5 side-right` → `1/5 front`).

**Not verified**

- The skeleton is visible in the streamed HTML (104 blocks confirmed in the SSR payload) but is
  effectively never *seen*, because the mock api resolves instantly and the route is prerendered.
  That is the correct outcome — the boundary is already in place for the real api — but it means the
  skeleton's appearance has not been judged by eye, only asserted on.
- Real product photography. Every angle is still a placeholder colour block, so the roll has been
  verified on colour transitions rather than on real images.
- The footer's three columns at the awkward widths between 768 and 1024 were measured for alignment
  and overflow, not reviewed at 768 / 896 in a screenshot.
- A real touch drag on the featured rail is still outstanding from session 3.

**Next session, first job:** admin — `featured` and `createdAt` are the two columns the home page
reads, and `getFeaturedProducts()` / `getNewArrivals()` are already shaped for them. Before that,
replace the placeholders in `lib/contact.ts` with the real workshop details; they are invented, and
`254700000000` is well-formed enough that it will not fail loudly.

---

### Session 5 — 2026-10-05 — Navbar separation, hero copy, heading polish, footer trim

**Status:** code complete, building, and **verified in a real browser**. Session 4's 87-check suite
re-run green (87/87) plus targeted checks for this session's four blocks.

Small, focused session as briefed. Nothing was rebuilt. Desktop browser tool disconnected again
(fourth session running), so headless Chromium again from `/tmp/opencode/verify/` — this session
added `navbar.js`, `shadow.js`, `headings.js`, `fmeasure.js`, `fparts.js`, `shots5.js`,
`regressions.js`.

**What changed**

- `app/globals.css` — `--pedigree-brown-dark: #4a332b`, bridged as `--color-primary-dark`. The only
  colour token added, as briefed.
- `components/layout/Navbar.tsx` — `bg-primary` → `bg-primary-dark`, `border-b border-black/10`, and
  the bar tightens 4px once scrolled (`h-16 md:h-20` → `h-[3.75rem] md:h-[4.75rem]`) alongside the
  existing `shadow-bar`. The scroll listener and the shadow were already there from session 1; only
  the height change is new.
- `app/page.tsx` — hero headline and subheadline rewritten; four section headings replaced by a
  `SectionHeading` component.
- `components/layout/Footer.tsx` — trimmed 318px → 244px on desktop.

**Verified**

- Navbar `rgb(74,51,43)` against hero `rgb(93,64,55)` — distinct at both 1440 and 375. Nav bottom
  and hero top are both 81px at 1440 (65px at 375): flush, so the 1px border is the only edge and
  there is no seam. Sticky at `top: 0` after a 400px scroll; height 81→77 desktop, 65→61 mobile;
  `shadow-bar` present when scrolled and gone at the top; returns to rest on scroll-back.
- Cream wordmark and links on the darker brown are 9.75:1, up from 7.78:1. The gold stitch under the
  active nav item improves from 4.43:1 to 5.55:1 — the darker bar makes the gold *more* legible, so
  no link colours needed changing.
- Hamburger visible at 375 and hidden at 1440; mobile drawer opens and closes on Escape.
- Section headings: 14px / 600 / `rgb(43,43,43)` / 1.4px letter-spacing, with the stitch rule filling
  the remaining width at every size (990px of 1088 at 1440, 245px of 343 at 375). Contrast went from
  5.37:1 to 11.83:1.
- Footer 318px → 244px at 1440 and 1024 (34% → 27% of a 900px viewport), 637px → 555px at 375.
- No regressions: cart adds and persists across a reload, the hybrid hover roll still resolves
  left/right/leave-to-front, no console errors.

**Decisions worth arguing with**

- **Headline: "Timeless leather goods, made by hand", not "Premium leather, crafted to last a
  lifetime".** The alternative claims a superlative the shop cannot substantiate, and at `lg:text-6xl`
  with `text-balance` it splits into four ragged lines, which undercuts the confidence it is trying to
  sound. Five words, covers both categories, and puts "made by hand" — the real differentiator — last.
- **The navbar's 4px height change is `h-*`, not `py-*`.** The brief asked for `py-3 → py-2.5`, but the
  bar is a flex row of fixed-height children, so changing vertical padding would not change its height
  at all. Silently doing nothing would have been worse than picking the property that works.
- **The section headings got the `stitch` rule rather than an accent dot or a plain hairline.** That
  dashed mark already appears under the active nav item and is quoted at the top of the hero, so it is
  the brand's existing divider. `tracking-widest` is what turned out to matter most visually; the rule
  is what makes it read as a section marker rather than a label.
- **No footer type was shrunk.** The 318 → 244 trim came entirely from padding, from folding the
  WhatsApp button into the contact column so it stopped being its own row, and from the address going
  comma-joined on one line above `sm`. Shrinking text to save space is how a footer starts reading as
  fine print. Mobile is still tall (555px) because a stacked footer carries three times the vertical
  spacing of a side-by-side one; making that shorter would mean hiding content or going two-column at
  375px, neither of which was asked for.
- The darker navbar is *better* for accessibility than the one it replaced — cream on it is 9.75:1
  rather than 7.78:1, and the gold accent crosses from 4.43:1 to 5.55:1. This was not the goal, but
  it means the separation is free rather than traded against legibility.

**Not verified**

- The navbar/hero edge was judged from screenshots at 1440 and 375 and from computed colours. There is
  no way to assert "subtle enough not to jar" programmatically; that is a judgement call, and the
  1.25:1 contrast between the two browns is deliberate.
- Between 768 and 1024 the navbar sits directly over the cream grid rather than over the hero, so the
  darker bar is the only brown on screen in that region. Correct, but not screenshotted at every
  breakpoint.

**Next session, first job:** admin — `featured` and `createdAt` are the two columns the home page
reads. Before that, replace the invented placeholders in `lib/contact.ts`.
