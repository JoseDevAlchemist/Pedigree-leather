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

## Roadmap

1. Tokens, fonts, layout, Navbar — **done (session 1)**
2. Data model (`lib/types.ts`), sample data, `lib/api.ts` data-access seam — **done (session 2)**
3. Angle viewer + colour switching — **done (session 2)**
4. Shop grid: product cards, discount badge, stock status — **done (session 2)**
5. Cart — **done (session 2)**
6. Grid breakpoints + compact mobile card, About removed, home page, shoes stub — **done (session 3)**
7. Checkout · 8. Supabase · 9. Admin · 10. Paystack · 11. Polish

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
