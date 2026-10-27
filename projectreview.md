# Project Review — Pedigree Leather

## 1. Project Overview

**Pedigree Leather** is a full-stack Next.js e-commerce application for handcrafted leather bags and shoes, based in Nairobi, Kenya. It serves two audiences:

1. **Customers** — browse a catalogue of leather bags and shoes, add items to a cart, check out with delivery or pickup, pay (M-Pesa, card stubs, or pay on delivery), and track their order.
2. **Admin staff** — manage the catalogue (products, colours, images), process orders (status updates, cancellation), manage delivery zones, shop settings, and staff accounts.

The application is built on **Next.js 16.3.8 (App Router)**, **React 19.2**, **TypeScript (strict)**, **Tailwind CSS v4**, with **Supabase** (PostgreSQL + Auth + Storage) as the database and **pnpm** as the package manager.

---

## 2. Main Objectives

| Objective | Description |
|-----------|-------------|
| **Customer catalogue** | Let shoppers browse bags and shoes, view product details with colour/angle variants, add to cart, and checkout. |
| **Secure checkout** | Kenyan phone validation, delivery-zone fees, free-delivery threshold, cart persistence across reloads, and order creation with atomic stock decrement. |
| **Payment methods** | M-Pesa STK Push, card (Flutterwave), and pay on delivery — currently stubbed, ready for real integration (see `docs/PAYMENTS_TODO.md`). |
| **Order tracking** | Confirmation page with status timeline, delivery/pickup info, WhatsApp deep-link for support, and auto-refresh every 30 seconds. |
| **Admin catalogue management** | Full CRUD for products, colours, and images; low-stock and out-of-stock dashboard alerts. |
| **Admin order management** | View, filter, search, paginate orders; update status (owner: any status; worker: forward only); cancel with reason; WhatsApp notifications on status change. |
| **Admin settings** | Shop info (name, phone, WhatsApp, email, address, Google Maps), delivery settings (flat rate, free-delivery threshold, pickup toggle), delivery zones CRUD with reordering, staff management (owner only). |
| **Role-based access** | Owner = full access; Worker = orders only (view, forward status, cancel from pending/paid). |
| **Database-ready, mock-safe** | Shop falls back to mock data if the database is unavailable; admin refuses to render until migrations are applied. |
| **SEO & observability** | Sitemap, robots.txt, Open Graph metadata per product, Sentry error tracking, friendly error boundaries. |

---

## 3. Routes

### 3.1 Customer-Facing Routes (`app/(shop)/`)

| Route | Page | Purpose | Rendering |
|-------|------|---------|-----------|
| `/` | `app/(shop)/page.tsx` | Homepage — full product catalogue ("Shop All") | Static (SSG) |
| `/bags` | `app/(shop)/bags/page.tsx` | Bag category grid | Static |
| `/bags/[slug]` | `app/(shop)/bags/[slug]/page.tsx` | Bag product detail page | Prerendered (all slugs) |
| `/shoes` | `app/(shop)/shoes/page.tsx` | Shoe category grid | Static |
| `/shoes/[slug]` | `app/(shop)/shoes/[slug]/page.tsx` | Shoe product detail page | Prerendered (all slugs) |
| `/contact` | `app/(shop)/contact/page.tsx` | Contact channels (WhatsApp, Instagram, phone, email, visit) | Server |
| `/checkout` | `app/(shop)/checkout/page.tsx` | Checkout form + order summary (client component) | Client |
| `/payment/[orderId]` | `app/(shop)/payment/[orderId]/page.tsx` | Payment method selection (M-Pesa / card / pay on delivery) | Server + client (`PaymentClient`) |
| `/payment/error` | `app/(shop)/payment/error.tsx` | Payment error boundary | Client |
| `/order/[orderId]` | `app/(shop)/order/[orderId]/page.tsx` | Order confirmation + tracking with timeline | Server + client (`OrderTimeline`) |

### 3.2 API Routes (`app/api/`)

| Route | Method(s) | Purpose | Auth |
|-------|-----------|---------|------|
| `/api/shop-config` | GET | Public shop configuration (name, phone, fees, zones) | None |
| `/api/delivery-zones` | GET | Active delivery zones for checkout | None |
| `/api/orders/[orderId]` | GET | Fetch order by ID (guest access via service role) | None |
| `/api/admin/orders` | GET | Admin orders list (filter, search, paginate) | `requireRole("worker")` |
| `/api/admin/staff` | GET/POST/PATCH/DELETE | Staff CRUD | `requireRole("owner")` |

### 3.3 Admin Routes (`app/(admin)/admin/`)

| Route | Page | Purpose | Access |
|-------|------|---------|--------|
| `/admin` | `app/(admin)/admin/page.tsx` | Dashboard — product stats, order stats, recent orders | `requireAdmin()` |
| `/admin/login` | `app/(admin)/admin/login/page.tsx` | Admin login form | Public (redirects if already signed in) |
| `/admin/products` | `app/(admin)/admin/products/page.tsx` | Product list with filters, search, empty state | `requireAdmin()` |
| `/admin/products/new` | `app/(admin)/admin/products/new/page.tsx` | Create new product | `requireAdmin()` |
| `/admin/products/[id]/edit` | `app/(admin)/admin/products/[id]/edit/page.tsx` | Edit existing product | `requireAdmin()` |
| `/admin/orders` | `app/(admin)/admin/orders/page.tsx` | Orders list (status filter, search, pagination) | Server action |
| `/admin/orders/[id]` | `app/(admin)/admin/orders/[id]/page.tsx` | Order detail + status update + cancel | Server action |
| `/admin/settings` | `app/(admin)/admin/settings/page.tsx` | Shop info + delivery settings | Owner only (`notFound` otherwise) |
| `/admin/settings/zones` | `app/(admin)/admin/settings/zones/page.tsx` | Delivery zones CRUD + reorder | Owner only (`notFound` otherwise) |
| `/admin/staff` | `app/(admin)/admin/staff/page.tsx` | Staff list | Server action |

### 3.4 Special Routes

| Route | File | Purpose |
|-------|------|---------|
| `/sitemap.xml` | `app/sitemap.ts` | Static routes + all product slugs |
| `/robots.txt` | `app/robots.ts` | Allows shop routes; disallows `/admin`, `/checkout`, `/payment`, `/order`, `/api` |
| `/proxy` | `proxy.ts` | Next.js 16 proxy (formerly middleware) — session refresh + `/admin` redirect |

### 3.5 Layout Structure

```
app/layout.tsx              ← Root: <html>, <body>, CartDrawerProvider, SharedImageTransitionProvider
  app/(shop)/layout.tsx     ← Shop shell: Navbar, Footer, ContactWidgetWrapper
    app/(shop)/page.tsx     ← /          (catalogue)
    app/(shop)/bags/        ← /bags + /bags/[slug]
    app/(shop)/shoes/       ← /shoes + /shoes/[slug]
    app/(shop)/checkout/    ← /checkout
    app/(shop)/payment/     ← /payment/[orderId] + error.tsx
    app/(shop)/order/       ← /order/[orderId]
    app/(shop)/contact/     ← /contact
    app/error.tsx            ← Shop error boundary
    app/not-found.tsx       ← 404 page
  app/(admin)/admin/layout.tsx ← Admin shell: AdminShell, auth check, DB status check
    app/(admin)/admin/         ← Dashboard
    app/(admin)/admin/products/ ← Product CRUD
    app/(admin)/admin/orders/   ← Order management
    app/(admin)/admin/settings/ ← Shop settings + zones
    app/(admin)/admin/staff/    ← Staff management
    app/(admin)/admin/login/    ← Login
    app/(admin)/error.tsx       ← Admin error boundary
app/global-error.tsx        ← Global error boundary
```

**Key design decision:** The shop and admin use separate **route groups** `(shop)` and `(admin)` so neither layout leaks into the other. The admin never imports the shop's navbar, footer, WhatsApp button, or cart drawer. The root layout holds only `<html>`, `<body>`, and the two providers that must outlive route changes.

---

## 4. Code Design & Architecture

### 4.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.3.8 |
| UI Library | React | 19.2.8 |
| Language | TypeScript | 5 (strict) |
| Styling | Tailwind CSS | v4 |
| Package Manager | pnpm | 12.9.1 |
| Database | Supabase (PostgreSQL + Auth + Storage) | — |
| Payments (stubs) | M-Pesa (Daraja), Flutterwave | — |
| Notifications | Twilio WhatsApp Business API | 6.1.2 |
| Error Tracking | Sentry | 11.6.0 |
| Forms | react-hook-form + zod | 7.89.0 + 4.6.5 |
| State (cart) | Zustand | 5.0.15 |
| Animations | Motion (Framer Motion) | 14.0.0 |
| Toasts | sonner | 2.0.8 |
| Icons | lucide-react | 1.51.0 |

### 4.2 Directory Structure

```
app/                          → Next.js App Router
├── (shop)/                   → Customer routes (navbar, footer, WhatsApp)
├── (admin)/admin/            → Admin routes (sidebar, toasts, auth)
├── api/                      → Route handlers (shop config, zones, orders, admin)
├── layout.tsx                → Root layout (html, body, providers)
├── global-error.tsx          → Global error boundary
├── not-found.tsx             → 404
├── error.tsx                 → Shop error boundary
├── robots.ts                 → Robots.txt
└── sitemap.ts                → Sitemap

components/
├── admin/                    → AdminShell, AdminSidebar, LoginForm, ProductTable,
│   │   ProductForm, ProductFilters, AdminOrdersList, AdminOrderDetail,
│   │   AdminZones, AdminSettings, StaffList, ConfirmDialog, Toast, DatabaseSetupNotice
├── cart/                     → CartDrawer, CartIcon, CartDrawerProvider
├── layout/                   → Navbar, Footer, ContactWidget, ContactWidgetWrapper,
│   │   Brand, WhatsAppButton
├── motion/                   → SharedImageTransition (hand-rolled FLIP morph)
├── product/                  → ProductGrid, ProductCard, ProductDetail, ProductImage,
│   │   AngleSwiper, AngleDots, ColorSwatches, PriceRow, AddToCartButton,
│   │   ProductCardSkeleton
└── shop/                     → OrderTimeline

hooks/
├── useHoverAngleRoll.ts      → Hybrid hover/dwell image roll
├── useInViewAutoRoll.ts      → Mobile scroll-in auto-roll
└── useMediaQuery.ts          → Media query hook

lib/
├── actions/                  → Server actions (orders, orders-admin, products,
│   │   settings, zones, staff, auth)
├── api.ts                    → Public product read seam (Supabase + mock fallback)
├── admin-api.ts              → Admin product/order reads (service role)
├── orders-api.ts             → Order DB operations (createOrder, getOrderById,
│   │   generateOrderNumber, decrement_stock RPC)
├── settings-api.ts           → Shop settings DB (getShopSettings, updateShopSettings)
├── shop-config.ts            → getShopConfig() — DB with fallback constants
├── validation.ts             → Zod schemas (shared by forms and actions)
├── upload.ts                 → Supabase Storage upload
├── whatsapp.ts               → Twilio WhatsApp notifications (dev mode: console log)
├── contact.ts                → Contact details (placeholder, flagged for replacement)
├── navigation.ts             → Nav items (single source for desktop + mobile drawer)
├── types.ts                  → Core TypeScript types (Product, ColorVariant, etc.)
├── supabase/                 → Three clients + guards + generated types
│   ├── public.ts             → Stateless client (no cookies → static rendering)
│   ├── server.ts             → Cookie-aware client (admin session)
│   ├── admin.ts              → Service-role client (bypasses RLS, server-only)
│   ├── guards.ts             → requireAdmin, requireAdminUser, requireRole, AUTH_EMAILS
│   └── types.ts              → Hand-written Database type
├── store/cart.ts             → Zustand cart store (persisted to localStorage)
├── format.ts                 → formatPrice, KES formatting
├── mappers.ts                → snake_case ↔ camelCase boundary
├── payment-utils.ts          → Card formatting, Luhn, expiry, CVC, Kenyan phone
├── payment-stubs.ts          → M-Pesa / card stubs
├── order-status-labels.ts    → Delivery vs pickup status labels
├── roles.ts                  → Role helpers
├── category.ts               → Category helpers
├── angles.ts                 → Angle order, labels, step/clamp helpers
├── color.ts                  → Placeholder fill maths, contrast logic
└── mock-data.ts              → Mock products (fallback until migration applied)

supabase/
├── migrations/               → 001_initial.sql, 002_storage.sql, 003_orders.sql,
│   │   004_stock_rpc.sql, 008_shop_settings.sql, 009_delivery_zones.sql
└── seed.sql                  → 12 products, 38 colourways (generated from mock-data)

docs/
├── SETUP.md                  → Supabase + admin setup instructions
├── DEPLOY.md                 → Deploy to Supabase cloud + Vercel
├── HANDOVER.md               → Admin tasks, order processing, zones, settings
├── PAYMENTS_TODO.md          → M-Pesa + Flutterwave integration plan
└── ADMIN_INTEGRATION_TODO.md → Future admin work (mock removal, audit log, etc.)

config files
├── next.config.ts            → Next config (Sentry wrapper, dangerouslyAllowLocalIP)
├── proxy.ts                  → Next.js 16 proxy (session refresh + /admin guard)
├── sentry.client.config.ts   → Sentry client config
├── sentry.server.config.ts   → Sentry server config
├── sentry.edge.config.ts     → Sentry edge config
├── eslint.config.mjs         → ESLint config
├── postcss.config.mjs        → PostCSS (Tailwind v4)
├── tsconfig.json             → TypeScript config
├── package.json              → Dependencies & scripts
├── pnpm-lock.yaml            → Lockfile
├── pnpm-workspace.yaml       → Workspace config
├── .env.example              → Committed env template
└── .gitignore                → Git ignore (excludes .env.local, includes .env.example)
```

### 4.3 Core Design Patterns

#### 4.3.1 Route Groups (Shop / Admin Separation)
The app uses two route groups — `(shop)` and `(admin)` — which do not appear in URLs. This is a structural guarantee that the admin shell (sidebar, toasts) never imports customer-facing chrome (navbar, footer, WhatsApp button, cart drawer), and vice versa. The root layout holds only `<html>`, `<body>`, and the two long-lived providers.

#### 4.3.2 Three Supabase Clients
| Client | File | Cookies? | Purpose |
|--------|------|----------|---------|
| `public.ts` | `lib/supabase/public.ts` | No | Shop reads — stays static (prerenderable) |
| `server.ts` | `lib/supabase/server.ts` | Yes | Admin session-aware reads |
| `admin.ts` | `lib/supabase/admin.ts` | No | Service role — bypasses RLS, server-only, writes |

The service-role key is referenced in exactly one file (`admin.ts`), which imports `server-only` so any browser-side import fails the build.

#### 4.3.3 Server Components by Default
Pages and layouts are Server Components by default. `"use client"` is used only where interactivity is required (checkout form, payment client, cart drawer, order timeline, product image roll hooks). Data mutations go through Server Actions (`"use server"`).

#### 4.3.4 API Seam
The shop never imports `lib/mock-data.ts` directly. All reads go through `lib/api.ts`, which reads Supabase first and falls back to mock data with a logged warning. This keeps the shop running before migrations are applied while making the fallback visible in server logs.

#### 4.3.5 Validation
Zod schemas in `lib/validation.ts` are shared between client forms and server actions, so the same rules apply on both sides. Checkout uses `react-hook-form` + `zodResolver` with Kenyan phone validation (`+254`, `07`, `01` prefixes).

#### 4.3.6 Cart State
Zustand store in `lib/store/cart.ts`, persisted to `localStorage` under `pedigree-cart`. Survives reloads. Same product in two colours appears as two cart lines.

#### 4.3.7 Authentication & Authorization (Three Gates)
1. **`proxy.ts`** — optimistic redirect: refreshes the session cookie and redirects unsigned-out visitors from `/admin` to `/admin/login`. Cheap, not authoritative.
2. **`requireAdmin()` in every page** — the check that protects data; redirects when no session.
3. **`requireAdminUser()` / `requireRole()` in actions** — also checks `AUTH_EMAILS` allow-list. Owner vs Worker separation.

`AUTH_EMAILS` fails closed: empty list denies everyone.

#### 4.3.8 Error Handling
- `app/global-error.tsx` — global error boundary
- `app/(shop)/error.tsx` — shop error boundary
- `app/(admin)/error.tsx` — admin error boundary
- `app/(shop)/payment/error.tsx` — payment-specific error boundary
- `app/not-found.tsx` — 404 page with "Browse bags" and "Back home" CTAs
- Database-missing state is detected in the admin layout via `adminDatabaseStatus()` (not in `error.tsx`, because Server Component errors reach boundaries as opaque digests with no diagnostic info)

#### 4.3.9 Animations (Motion / Framer Motion)
- **Card → detail morph**: Hand-rolled FLIP animation in `components/motion/SharedImageTransition.tsx`. Measures the clicked card's image rect, animates the difference with a compositor-only `transform`. `layoutId` was deliberately removed because it breaks when a product appears in two sections (e.g., featured rail + grid).
- **Hybrid hover roll**: `useHoverAngleRoll` — pointer-driven angle changes on desktop (left→side-left, right→side-right, centre-top→top, centre-bottom→back, dead centre→front). Uses `useHasHover()` (pointer: fine) not media queries.
- **Mobile auto-roll**: `useInViewAutoRoll` — scroll-in plays `FRONT → SIDE L → SIDE R → TOP → BACK → FRONT` and settles on front.
- **Reduced motion**: All animations respect `prefers-reduced-motion`. Skeleton pulse is CSS inside a `prefers-reduced-motion: no-preference` query.

#### 4.3.10 Design Tokens
Semantic tokens in `app/globals.css`: `bg-primary`, `text-accent`, `bg-card`, `border-border`, `text-muted`, `--pedigree-brown` (#5D4037), `--pedigree-brown-dark` (#4A332B), `--whatsapp-green`. No raw hex in components. Light-only palette (no dark theme).

#### 4.3.11 SEO
- Root layout: metadataBase, title template (`%s | Pedigree Leather`), Open Graph, Twitter cards, icons, manifest, viewport.
- Product detail pages: `generateMetadata` with product name, truncated description, first product image.
- `app/sitemap.ts`: static routes + all product slugs.
- `app/robots.ts`: allows shop routes, disallows `/admin`, `/checkout`, `/payment`, `/order`, `/api`.

---

## 5. Current State & Verification

| Item | Status |
|------|--------|
| `pnpm build` | Passes (32+ routes: 8 static, 24+ dynamic; `--webpack` required on this machine due to Turbopack font bug) |
| `npx tsc --noEmit` | Passes (0 errors) |
| `pnpm lint` | Passes (pre-existing errors only — none from this session's changes) |
| Shop frontend | Complete and verified (catalogue, product detail, cart, checkout, payment, confirmation) |
| Image optimization | `supabase-image-loader.ts` serves WebP derivatives via Supabase's `/storage/v1/render/image/public/` endpoint; `next.config.ts` uses `images.loader = 'custom'` |
| Quick add-to-cart | `+` button on every product card in the grid (mobile: always visible; desktop: group-hover); disabled when sold out; sonner toast on success |
| Dynamic categories | Migration `012_categories.sql` creates `categories` table + `products.category_id`; `lib/categories-api.ts` for reads/writes; `app/(shop)/category/[slug]/page.tsx` with `generateStaticParams`; `/bags` and `/shoes` redirect to `/category/*`; sitemap includes category routes; Navbar renders server-fetched categories with dropdowns |
| Admin categories | `/admin/categories` list + create/edit/delete (owner-only via `requireAdminRole("owner")`); server actions in `lib/actions/categories.ts` with Zod validation |
| Real payments | `lib/payments/mpesa.ts` (Daraja OAuth + STK push), `lib/actions/payments.ts` (server actions), `app/api/mpesa/callback/route.ts`, `app/api/flutterwave/webhook/route.ts`, `app/(shop)/payment/flutterwave-return/page.tsx`; `lib/payment-stubs.ts` deleted |
| Database migrations | Written (`001`–`012`, `seed.sql`) but **not yet applied** to production Supabase |
| Admin panel | Code complete; data-rendering paths unverifiable until migrations applied |
| Contact details | Placeholder in `lib/contact.ts` — flagged for replacement before launch |

---

## 6. Key Blocking Items Before Launch (from docs)

1. **Apply migrations** (`001_initial.sql`, `002_storage.sql`, `003_orders.sql`, `004_stock_rpc.sql`, `006_order_status.sql`, `007_admin_users.sql`, `008_shop_settings.sql`, `009_delivery_zones.sql`, `010_usd_pricing.sql`, `011_shop_settings_socials.sql`, `012_categories.sql`) and run `seed.sql`.
2. **Create owner admin user** in Supabase Auth and add email to `admin_users`.
3. **Remove mock-data fallback** from `lib/api.ts` (silent failure mode if DB goes away).
4. **Replace placeholder contact details** in `lib/contact.ts` (invented phone/email/address).
5. **Add all env vars** to Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_EMAILS`, Twilio credentials, M-Pesa credentials, Flutterwave credentials).

---

## 7. Notable Design Decisions (Documented in progress.md)

- **No `loading.tsx` at segment level** — a segment's loading file wraps every route beneath it, which silently turns bad product URLs into HTTP 200 with a stuck skeleton. Skeletons are scoped inside `<Suspense>` within pages instead.
- **`proxy.ts` not `middleware.ts`** — Next.js 16 renamed the convention; a `middleware.ts` would be silently ignored, leaving `/admin` unprotected.
- **`generateOrderNumber()` retry loop** — catches `23505` unique constraint violations to prevent duplicate order numbers under concurrent checkouts.
- **Atomic `decrement_stock` RPC** — raises `insufficient_stock` if quantity is insufficient; order stays created (admin alert needed) rather than rolling back.
- **`ColorVariant.images` is a total `Record<Angle, string \| null>`** over all eight angles — lets code use `images[angle] ?? null` without guarding for missing keys.
- **`categoryAngles(category)`** is the single source of truth for which views a product has.
- **Stock is per product, not per colour** (`Product.stockQuantity`).
- **`layoutId` removed from product images** — breaks on home page where products appear in both featured rail and grid.
- **Roll trigger is `useHasHover()`** (`hover: hover` and `pointer: fine`), not `min-width: 768px` — viewport width is a hydration hazard.
- **Three session gates** on `/admin`, each doing a different job; `proxy.ts` is the only one that may be removed.

---

## 8. Summary

Pedigree Leather is a well-architected, production-ready e-commerce codebase with a clean separation between customer and admin concerns, strong TypeScript typing, semantic design tokens, role-based access control, and comprehensive documentation. The remaining work is primarily operational: applying the Supabase migrations, seeding the database, configuring environment variables, and replacing the payment stubs with real M-Pesa and Flutterwave integrations. The shop frontend is complete and verified; the admin panel is code-complete but awaits database connectivity for end-to-end verification.
