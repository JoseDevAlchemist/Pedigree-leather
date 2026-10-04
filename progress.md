# Pedigree Leather — build progress

Log of what has been built and verified. Newest session at the bottom.
The developer commits; no git commits are made here.

## Current Verified State

_(updated at the end of each session)_

- Next.js 16.3.8 (App Router, Turbopack), React 19.2, TypeScript strict, Tailwind CSS v4, pnpm.
- Design tokens live in `app/globals.css` only. Components must use token classes
  (`bg-primary`, `text-accent`, `bg-card`, `border-border`, `text-muted`); no raw hex in components.
- `<Navbar />` is mounted in `app/layout.tsx` and renders on every route.
- Favicon resolves from `app/icon.png` (generated from `Pedigree logo.jpeg`).
- `/bags` is a real shop grid and `/bags/[slug]` is a real product page. All six product pages
  are prerendered (`generateStaticParams`), so the route is fully static.
- Cart state lives in `lib/store/cart.ts` (Zustand, persisted to localStorage under
  `pedigree-cart`) and survives a reload.
- `pnpm build` and `pnpm lint` pass. **The browser verification pass for session 2 has NOT been
  done** — see the session 2 entry for exactly what is still unverified.

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
- **`layoutId` cannot carry a card → detail morph across an App Router route change.** React
  unmounts the old page and mounts the new one in the same commit, and Motion's
  `unmount()` calls `NodeStack.remove(this)`, so by the time the detail page's projection
  node registers there is no previous node to inherit a snapshot from. `layoutId` is still
  set on both ends (`card-image-${id}`), but the morph is driven by
  `components/motion/SharedImageTransition.tsx`: the card measures its image rect at click
  time, the detail page measures itself in a layout effect and animates the difference with
  a compositor-only `transform`. The morphing wrapper is deliberately **not** the `layoutId`
  element, because Motion's projection owns that element's transform.
- Colour names and prices are the only user-facing strings; nothing about a product is
  hardcoded in a component. `lib/api.ts` is the single read path — components must never
  import `lib/mock-data.ts`.
- Stock is **per product, not per colour** (`Product.stockQuantity`). `GEMINI.md` asked for
  per-colour stock; the session 2 brief simplified it. If per-colour stock is wanted later,
  add `stockQuantity` to `ColorVariant` — the sold-out UI already reads one number.
- Added two files beyond the brief: `lib/angles.ts` (angle order, labels, and the step/clamp
  helpers shared by the card's arrow keys, the swiper arrows and the dots) and `lib/color.ts`
  (placeholder fill maths; also decides whether a colour name should be `text-foreground` or
  `text-background`, which matters because the grid holds both cream `#EFE3D2` and black
  `#1C1C1C` swatches).
- `zustand` was **added** as a dependency (the session 2 brief required it) even though
  `GEMINI.md` says not to add major dependencies without asking. Flagging it here so the
  next session knows it was a deliberate, brief-driven exception.

## Roadmap

1. Tokens, fonts, layout, Navbar — **done (session 1)**
2. Data model (`lib/types.ts`), sample data, `lib/api.ts` data-access seam — **done (session 2)**
3. Angle viewer + colour switching — **done (session 2)**
4. Shop grid: product cards, discount badge, stock status — **done (session 2)**
5. Cart — **done (session 2), needs browser verification**
6. Checkout · 7. Supabase · 8. Admin · 9. Paystack · 10. Polish

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
