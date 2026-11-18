# Pedigree Leather — project reference

Last reviewed: 16 November 2026. Based on the local source code, SQL migrations, package manifest, and existing documentation. This is the consolidated reference for the current repository; it does not certify the state of a deployed website or remote Supabase database.

## Contents

1. [Purpose and features](#purpose-and-features)
2. [Technology and architecture](#technology-and-architecture)
3. [Routes](#routes)
4. [Supabase](#supabase)
5. [Authentication and permissions](#authentication-and-permissions)
6. [Catalogue, cart, and checkout](#catalogue-cart-and-checkout)
7. [Payments and notifications](#payments-and-notifications)
8. [Design system](#design-system)
9. [Configuration and development](#configuration-and-development)
10. [SEO, monitoring, and errors](#seo-monitoring-and-errors)
11. [Known limitations](#known-limitations)
12. [File guide and maintenance](#file-guide-and-maintenance)

## Purpose and features

Pedigree Leather is a Kenyan leather goods storefront with an internal staff administration area. Its branding describes handcrafted bags and shoes made in Nairobi. The configured fallback shop location is Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya.

Customers can browse products, search, filter categories, inspect photographs by colour and viewing angle, maintain a cart, choose delivery or pickup, submit a guest order, select a payment method, and view order progress. There is no customer account or customer sign-up interface in the route tree.

Staff can manage products and photographs, categories, orders, delivery zones, shop settings, and staff membership. The intended roles are `owner` and `worker`; see the permission caveats below.

The home page is currently a catalogue headed “Our Catalogue”. Historical references to a full-screen hero, featured carousel, and new-arrivals rail describe an older home page. Featured/new-arrival data helpers remain available.

## Technology and architecture

Versions below are declarations from [package.json](package.json), not a claim about globally installed tools.

| Layer | Implementation |
| --- | --- |
| Framework | Next.js `16.3.8`, App Router |
| UI | React / React DOM `19.2.8` |
| Language | TypeScript 5, strict mode, `@/*` root import alias |
| Styling | Tailwind CSS 4 with CSS-first theme tokens |
| Backend | Supabase PostgreSQL, Auth, and Storage |
| Package manager | pnpm `12.9.1` |
| Forms and validation | React Hook Form, Zod 4, Hook Form resolvers |
| Cart | Zustand 5 with browser persistence |
| Motion | Motion 14, custom image transition and image-roll hooks |
| UI utilities | Lucide icons, Sonner, clsx |
| Integrations | Safaricom Daraja, Flutterwave groundwork/demo, Twilio WhatsApp, Resend, React PDF, Sentry |

### Request and data flow

```text
Shop pages / interactive components
  ├─ product reads → lib/api.ts → public Supabase client → PostgreSQL
  │                              └─ mock catalogue on read failures
  ├─ cart → Zustand → localStorage
  └─ checkout / payment → server actions → service-role client → PostgreSQL
                                            └─ payment / notification providers

Admin browser → proxy session refresh → admin layout membership check
  └─ pages / API / actions → server permission checks → Supabase

Payment provider → webhook route → order payment/status update → receipt where wired
```

`app/(shop)` and `app/(admin)` are route groups, omitted from public URLs. The shop layout supplies navigation, footer, and contact UI. The admin layout supplies its own shell, sidebar, toast provider, and database setup notice. Root `app/layout.tsx` supplies fonts, global metadata, cart drawer and shared image transition providers.

Most data pages use Server Components; interactive forms, cart, and payment UI use Client Components. Mutations largely use `lib/actions/*` server actions. Next route handlers provide JSON and webhook endpoints. Database column names are generally snake_case; application models use camelCase through `lib/mappers.ts`.

## Routes

### Customer pages

| URL | Behaviour |
| --- | --- |
| `/` | Full catalogue with a Suspense grid placeholder |
| `/bags` | Redirects to `/category/bags` |
| `/shoes` | Redirects to `/category/shoes` |
| `/category/[slug]` | Admin-managed category, including direct child category products; URL filters |
| `/bags/[slug]` | Bag detail, photographs, colours, quantity, add to cart |
| `/shoes/[slug]` | Shoe detail |
| `/search?q=...` | Product search |
| `/contact` | Shop contact information |
| `/checkout` | Guest contact, cart summary, delivery/pickup, order submission |
| `/payment/[orderId]` | Payment options for an order; explicitly dynamic |
| `/payment/flutterwave-return` | Server-side Flutterwave transaction verification and order update |
| `/order/[orderId]` | Confirmation and progress timeline |
| `/legal/[slug]` | Database-backed legal text; seeded slugs: `privacy`, `terms`, `returns` |

`error.tsx` files are error boundaries, not URLs: there is no `/payment/error` page merely because `app/(shop)/payment/error.tsx` exists.

### Administration pages

All paths below live under `app/(admin)/admin`.

| URL | Purpose / intended access |
| --- | --- |
| `/admin/login` | Email/password login |
| `/admin/forgot-password` | Request a Supabase password recovery email |
| `/admin/reset-password` | Exchange recovery code and update password |
| `/admin` | Dashboard: catalogue, stock, orders, recent activity summaries |
| `/admin/products` | Product list, search, and filters |
| `/admin/products/new` | Create product |
| `/admin/products/[id]/edit` | Edit product, colour stock, angles, images, pricing |
| `/admin/categories` | Category list |
| `/admin/categories/new` | Create category |
| `/admin/categories/[id]` | Edit category |
| `/admin/orders` | Orders with status/search/pagination; worker or owner |
| `/admin/orders/[id]` | Order detail, status changes, cancellation; worker or owner |
| `/admin/settings` | Shop information and delivery settings; owner |
| `/admin/settings/zones` | Delivery zones; owner |
| `/admin/staff` | Staff membership and roles; owner |

The sidebar's visible links are not the security boundary. Product write actions currently check admin membership rather than requiring the owner role.

### HTTP endpoints and generated resources

| Endpoint | Methods | Purpose / access |
| --- | --- | --- |
| `/api/shop-config` | GET | Public shop settings |
| `/api/delivery-zones` | GET | Public active delivery zones |
| `/api/orders/[orderId]` | GET | Public guest order lookup by UUID, using server-side service role |
| `/api/admin/orders` | GET | Guarded order listing; worker or owner |
| `/api/admin/staff` | GET, POST, PATCH, DELETE | Guarded staff management; owner |
| `/api/mpesa/callback` | POST | Daraja callback; matches stored checkout request ID |
| `/api/flutterwave/webhook` | POST | Checks webhook hash and verifies transaction with Flutterwave |
| `/sitemap.xml` | GET | Generated catalogue/category sitemap |
| `/robots.txt` | GET | Generated crawler rules |

`proxy.ts` is a Next.js request interception convention, not a `/proxy` page.

## Supabase

### Client separation

| File | Credential / session | Usage |
| --- | --- | --- |
| `lib/supabase/public.ts` | Public anon key, no cookies | Storefront reads without a cookie dependency |
| `lib/supabase/client.ts` | Public anon key, browser session | Browser auth and image uploads |
| `lib/supabase/server.ts` | Public anon key, request cookies | Session-aware server auth and queries |
| `lib/supabase/admin.ts` | Service-role key, server-only | Privileged order/admin operations; bypasses RLS |

`lib/supabase/types.ts` holds the repository's database types. Compare these with migrations when changing the schema; they should not be assumed to reflect an independently inspected live database.

### Database model

| Table | Main data and relationships |
| --- | --- |
| `products` | UUID, unique slug, name, description, legacy `bag`/`shoe` type, category reference, KES base price, optional USD price, discount, featured/active flags, timestamps |
| `product_colors` | Product reference, colour name/hex, sort order, `stock_quantity` per colour |
| `product_images` | Colour reference, viewing angle, image URL, ordering |
| `categories` | Name, slug, optional parent category, display order, active flag |
| `orders` | Unique order number, guest contact, delivery method/address/fee/zone, totals, fulfilment and payment states, payment references, notes, timestamps |
| `order_items` | Order/product references and snapshots of product name/slug, colour, quantity, unit price, line total |
| `order_status_history` | Order reference, previous/new status, staff email, note, timestamp |
| `admin_users` | Unique email, owner/worker role, optional display name, UUID, creation time |
| `shop_settings` | Shop contact/social information, delivery flat rate, free-delivery threshold, pickup availability |
| `delivery_zones` | Zone name, fee, active flag, display order |
| `legal_pages` | Slug primary key, title, plain text content, updated timestamp |

Stock now belongs to `product_colors`, not `products`. Storefront reads hide zero-stock colours and products with no available colours. Product detail routes still use the legacy bag/shoe type even though merchandising categories are database-managed.

### Migrations

Apply the actual filenames in numeric order; numbering gaps are present in the repository and do not imply files should be invented or renamed.

| File | Change |
| --- | --- |
| `001_initial.sql` | Products, colours, images, indexes, RLS |
| `002_storage.sql` | Public product image bucket and storage policies |
| `003_orders.sql` | Orders and order items |
| `004_stock_rpc.sql` | Original product stock decrement function; superseded by 022 |
| `006_order_status.sql` | Fulfilment status vocabulary and history |
| `007_admin_users.sql` | Staff membership/roles and initial owner row |
| `008_shop_settings.sql` | Shop settings |
| `009_delivery_zones.sql` | Zones and order zone fields |
| `010_usd_pricing.sql` | Optional USD display pricing |
| `011_shop_settings_socials.sql` | Instagram settings |
| `012_categories.sql` | Category hierarchy and product category reference |
| `013_mpesa_payments.sql` | Checkout request ID, payment reference, paid timestamp |
| `014_manual_mpesa.sql` | Manual M-Pesa method support |
| `021_categories_reconcile.sql` | Reconciles category schema and policies |
| `022_color_stock.sql` | Distributes existing product stock across colours, adds `decrement_color_stock`, removes product stock and old RPC |
| `023_legal_pages.sql` | Legal content table and placeholder policies |

`supabase/seed.sql` supplies sample catalogue data and already uses colour stock; apply the complete migration chain before loading this seed into a fresh database. Inspect seed SQL before running it against an existing shop. No database migrations or seed scripts were executed for this documentation review.

### Storage and product photography

Bucket: `product-images`, publicly readable. Uploads use the signed-in browser client and storage RLS. The upload helper accepts JPEG, PNG, WebP, and AVIF, with a 4 MiB application limit.

Object names follow `<product-slug>/<colour>-<angle>.<extension>`. Upload replacement reuses the path. Image URLs can carry cache-busting query parameters.

`supabase-image-loader.ts` requests square WebP derivatives through Supabase's image transformation endpoint. Product frames use 800px or 1200px buckets; small thumbnails retain their requested size. Quality is configured at 75. Local/data/blob and unrelated external URLs pass through. `next.config.ts` contains Supabase remote patterns and permits local IP images for development.

### Row Level Security

SQL enables RLS with public reads for storefront data and authenticated write policies for several tables/storage operations. Many policies say `authenticated` with broad conditions rather than checking `admin_users` or owner/worker roles. Orders also have anonymous insert policies in the migrations. Consequently, application checks and database checks currently provide different levels of restriction. A service-role operation bypasses RLS entirely.

## Authentication and permissions

Authentication uses Supabase email/password sessions, with login/logout implemented in `lib/actions/auth.ts`. Staff membership and roles come from `admin_users`, replacing the older `AUTH_EMAILS` environment allow-list described in historical docs.

1. `proxy.ts` verifies/refreshes the Supabase user and copies refreshed cookies to request/response. It redirects unauthenticated admin visitors to login, except login and password-recovery routes.
2. The admin layout checks whether a signed-in email belongs to `admin_users`, then renders the appropriate shell or an authorization refusal.
3. `lib/supabase/guards.ts` provides session, membership, and role guards. `lib/roles.ts` provides another role lookup/guard implementation. Individual actions/API handlers must enforce their required permission.

Owners can use worker operations. Workers have constrained forward order transitions and can cancel only early-stage orders through the dedicated cancellation action. Owners have broader transition permissions. Staff actions include last-owner safeguards; staff membership creation inserts a database row, and does not itself provision a Supabase Auth account.

For first setup, create the user's Auth account and ensure a matching owner row exists in `admin_users`. Migration 007 contains a preconfigured owner email; review it for the target installation. Store emails consistently because lookups compare stored email values.

Forgot-password requests use Supabase recovery email. The reset page exchanges a query-string code for a session and calls `auth.updateUser`. Configure the site's real recovery redirect URL in Supabase Auth settings.

**Current authentication discrepancy:** `isAllowedAdmin` is asynchronous, but `loginAction` calls it in boolean conditions without `await`, and still contains `AUTH_EMAILS` error wording. Those login checks do not enforce membership as intended. The awaited admin-layout and action membership checks are separate controls. This document records the issue; no authentication code was changed.

## Catalogue, cart, and checkout

### Products and filtering

`lib/api.ts` is the storefront read boundary. It queries Supabase and falls back to `lib/mock-data.ts` on failures, logging warnings once per cause. A successful empty result remains empty. Admin reads use `lib/admin-api.ts` and present a setup notice when required database structures are absent.

Category filters use `colors`, `minPrice`, `maxPrice`, and `sort` URL parameters. Sort values are `newest`, `price_asc`, and `price_desc`. Colour names are normalized for selection while retaining stored spellings for database queries. Price filtering/sorting uses base price. Category scope includes the category and its direct children.

Products carry KES pricing, optional USD display pricing, percentage discount, colour variants, and a chosen angle sequence. Supported angle names are `front`, `side-left`, `side-right`, `side`, `top`, `bottom`, `back`, and `laces`. Missing photographs render placeholders using colour data. Hover, mobile visibility, swipe, dots, and shared image transitions support product exploration.

### Cart

`lib/store/cart.ts` persists items to localStorage under `pedigree-cart` (storage version 1). A line is identified by product ID plus colour ID. It stores denormalized names, prices, image, quantity, and a stock snapshot. Quantities are capped at ten per line and the stored stock ceiling; a quantity below one removes the line. Server checkout still needs authoritative validation because browser state can be altered or become stale.

### Checkout and orders

Checkout collects name, optional email, Kenyan phone, delivery/pickup, address/zone, and optional notes. Phone validation normalizes accepted local/international forms to `+254...`. Delivery addresses must contain at least ten characters; notes are limited to 500 characters.

Fallback business settings in `lib/shop-config.ts` are KES 300 delivery, free delivery from KES 25,000, and pickup available. Database settings override these. Zone fees are read from the server rather than trusted from the browser.

`createOrderAction` passes validated customer/delivery data and cart content to `lib/orders-api.ts`. The order layer checks live colour stock and product/colour association, generates `PED-YYYY-XXXX` numbers with collision retries, inserts the order/items, and calls `decrement_color_stock` for each line.

Each stock RPC conditionally decrements a colour without going below available stock. **The complete order is not one database transaction:** inserts and decrements are separate calls; stock errors after order creation are logged and do not roll back the order. Stock is consumed at order creation, before payment. The cancellation action does not currently restore stock.

Fulfilment states are `pending_payment`, `paid`, `preparing`, `ready_for_delivery`, `out_for_delivery`, `delivered`, and `cancelled`. Pickup-specific UI labels reinterpret the applicable stages. Payment state is tracked separately. Status history records transitions and staff notes. The customer timeline refreshes order information periodically.

## Payments and notifications

| Method | Current implementation |
| --- | --- |
| M-Pesa STK | Daraja token acquisition and STK initiation implemented in `lib/payments/mpesa.ts`; server takes the amount from the saved order |
| Manual M-Pesa | Saves an 8–12 character confirmation code as a claim; remains pending until staff verify it |
| Card | Current UI uses a demo completion action that can mark the order paid; real card charging is unfinished |
| Pay on delivery | Records the method and keeps payment pending |

M-Pesa supports sandbox/production selection and normalizes phone numbers. The initiation action stores `checkout_request_id`; the callback correlates it to an order, ignores unknown/already-paid requests, records success/failure and receipt details, and advances a pending-payment order on success. The payment UI polls the public order endpoint for results.

Flutterwave webhook and return handlers exist and verify transaction status/reference with the provider. Their existence does not mean the demo card UI performs a real charge. The current verification code does not compare verified amount/currency against the saved order.

Twilio WhatsApp helpers notify the shop/customer about new orders and customer status changes. Missing provider credentials use a development logging fallback. Notification failures are logged without undoing the order.

`lib/emails/ReceiptPDF.tsx` builds a PDF receipt. `lib/emails/sendReceipt.ts` sends it through Resend with escaped HTML customer fields. Receipt sending is wired into successful M-Pesa callbacks and manual staff transitions to paid. It requires a customer email and Resend configuration; the default sender uses Resend's onboarding domain. Demo-card/Flutterwave updates do not share every receipt/history step.

## Design system

The visual direction is warm leather, cream surfaces, brown structure, gold accents, serif headings, and restrained motion. The main source is [app/globals.css](app/globals.css).

| CSS primitive | Hex | Semantic use |
| --- | --- | --- |
| `--pedigree-brown` | `#5D4037` | `primary`, brand brown |
| `--pedigree-gold` | `#D4AF37` | `accent`, gold |
| `--pedigree-cream` | `#F5E9D9` | `background` |
| `--pedigree-charcoal` | `#2B2B2B` | `foreground` |
| `--pedigree-brown-deep` | `#3B2A24` | `primary-deep` |
| `--pedigree-brown-dark` | `#4A332B` | `primary-dark`, darker navigation surface |
| `--pedigree-gold-bright` | `#E8CE7A` | `accent-ink`, light gold text |
| `--pedigree-cream-soft` | `#FCF6EE` | `card` |
| `--pedigree-border` | `#E2D3BF` | Warm decorative borders |
| `--pedigree-muted` | `#6E5B4C` | Secondary text |
| `--pedigree-danger` | `#9C3323` | `destructive`, validation/cancellation |
| `--whatsapp-green` | `#25D366` | WhatsApp button |

`@theme inline` maps these primitives to Tailwind classes such as `bg-background`, `bg-primary`, `text-muted`, and `border-border`. Prefer semantic classes when extending the UI. Some exceptions remain: `.bg-leather-header` uses a `#4A2E20 → #3A2217 → #2D1A11` gradient, receipt/email templates contain fixed colours, and status components use additional utility colours.

Typography uses Google fonts through `next/font`: Manrope for body/UI (`--font-sans`), and Cormorant Garamond weights 500/600/700 for display (`--font-serif`).

Global shadow tokens cover navigation bar, side panel, resting card, and lifted card. The `stitch` utility draws a dashed navigation marker. `scrollbar-none` supports scrollable rails. Skeletons pulse opacity for 1.7 seconds only when reduced motion is not requested. Components include responsive layouts, focus treatments, confirmation dialogs, empty states, and image placeholders; these are implementation features, not a completed accessibility audit.

Brand assets include `public/pedigree-logo.png`, `app/icon.png`, and the root `Pedigree logo.jpeg` reference. Other files in `public` include starter framework SVGs.

## Configuration and development

### Environment variables

Use [.env.example](.env.example) as the template for an uncommitted `.env.local`. Secret values are intentionally omitted here. Public-prefixed values can be included in browser bundles and must be configured before a production build.

| Variables | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase endpoint and public client credential |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged database credential |
| `NEXT_PUBLIC_APP_URL` | Site origin for metadata, sitemap, robots; localhost fallback |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | Daraja credentials |
| `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENV` | Merchant, public callback URL, sandbox/production |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Verification requests and webhook authentication |
| `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY` | Listed as future configuration in template; not current real-card activation |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `SHOP_WHATSAPP_NUMBER` | WhatsApp notifications |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional receipt email and optional sender override |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional error tracking and build integration |

`AUTH_EMAILS` is historical, not the current membership source. The repository's local Supabase TOML includes additional service-specific environment placeholders; these are not all application requirements.

### Local workflow

```bash
pnpm install
cp .env.example .env.local
# Fill in your own configuration without committing secrets.
pnpm dev
```

The Next development site normally runs at `http://localhost:3000`. For a local Supabase stack, install the Supabase CLI and Docker separately, then use `supabase start` and `supabase migration up`; `supabase status` provides local connection details. A linked hosted database can receive reviewed migrations through `supabase db push`. These commands are operational guidance, not actions performed during this review.

Local service configuration is in `supabase/config.toml` (including API/auth/storage settings). Auth settings in that file are development settings, including enabled sign-up and disabled email confirmation; configure production separately.

Available application scripts:

```bash
pnpm lint     # ESLint
pnpm build    # production build
pnpm start    # serve production build
```

There is no `test` script or committed automated test suite in the inspected file inventory. This documentation-only change did not run the application or validate external credentials.

Deployment notes in `docs/DEPLOY.md` target hosted Supabase plus Vercel. Production setup needs environment variables, migrated database/storage, an Auth account plus admin membership, approved recovery redirects, a public HTTPS payment callback, and provider configuration. A deployed domain, remote schema, and live provider readiness were not verified here.

## SEO, monitoring, and errors

Root metadata includes a title template, Kenyan locale Open Graph metadata, Twitter card, descriptions, keywords, and icons. Product detail pages generate individual metadata. `app/sitemap.ts` enumerates static, category, and product URLs. `app/robots.ts` excludes admin, checkout, payment, order, and API areas from crawling; crawler rules do not restrict application access.

Error handling includes global, shop, admin, and payment boundaries plus a root not-found page. Admin database readiness is checked in the layout to show an actionable setup notice.

Sentry client/server/edge configuration files are present; `next.config.ts` wraps the build only when a DSN is set. `instrumentation.ts.bak` is a backup, not an active Next instrumentation entry. Runtime reporting should be verified before describing monitoring as operational. Root metadata references `/manifest.json`, but no matching public manifest was present in the inspected inventory.

## Known limitations

These observations describe the local implementation, not results from a production penetration test or live integration test.

1. **Card payments are a demo.** Public server actions can mark a card order paid without provider settlement. Replace this flow before relying on card payment status.
2. **Checkout trusts browser pricing.** Customer/delivery fields are validated, but cart JSON, unit prices, subtotal, and discount totals are not fully reconstructed and validated from authoritative product records. Delivery fees use server settings, but the free-delivery threshold also depends on the supplied subtotal.
3. **Guest order access uses the UUID.** Public order pages/API use service-role reads without customer login or a separate access token. The JSON lookup returns the order with items/history and stored fields; do not assume payment identifiers or customer details stay private merely because initiation does not return them.
4. **Order and stock changes are separate writes.** A partially completed operation can leave an order created with stock decrement failures; cancellation/payment abandonment do not implement stock release.
5. **Permissions need consolidation.** Broad authenticated database/storage policies are weaker than the intended staff roles. Product actions check membership rather than owner role, and role helpers are duplicated.
6. **Login has unawaited membership checks.** See the authentication discrepancy above. Staff actions also use a service-role client's `auth.getUser()` in some self-protection checks, which should be reviewed against the actual signed-in session.
7. **Provider checks have gaps.** Flutterwave verification lacks order amount/currency comparison. M-Pesa callback handling correlates a checkout request ID but does not perform independent transaction/amount verification; initiation and callback persistence also occur in separate steps.
8. **Notifications are best effort.** Missing email/provider configuration skips delivery, and receipt/history behaviour differs by payment path. There is no durable notification retry queue in the inspected code.
9. **Fallback data can mask an outage.** A healthy-looking catalogue may be mock data. Checkout still needs a working database and valid live colour IDs.
10. **Legal text is placeholder content.** Migration 023 seeds placeholders; content is edited through the database, with no dedicated legal editor route.
11. **Contact sources differ.** `lib/contact.ts`, fallback shop config, settings rows, and email sender defaults contain different email domains. Confirm the intended public contact details and update their consumers consistently.
12. **Older documents contain stale claims.** In particular: `AUTH_EMAILS`, all payments being stubs, product-level stock, `/payment/error` as a page, and `/bags` or `/shoes` as standalone grids.

## File guide and maintenance

| Location | Responsibility |
| --- | --- |
| `app/` | Pages, layouts, API handlers, metadata resources, global styles |
| `components/admin/` | Admin shell, forms, tables, orders, settings, staff, zones |
| `components/product/` | Product grid/cards/detail, images, swatches, angle controls |
| `components/cart/` | Drawer provider, drawer, cart icon |
| `components/layout/` | Brand, navigation, footer, WhatsApp/contact widgets |
| `components/shop/` | Filter bar and order timeline |
| `components/motion/`, `hooks/` | Image transition and interaction hooks |
| `components/ui/` | Skeleton and quantity stepper |
| `lib/api.ts`, `lib/categories-api.ts` | Public catalogue/category reads |
| `lib/admin-api.ts` | Admin catalogue/dashboard operations and readiness checks |
| `lib/orders-api.ts`, `lib/settings-api.ts` | Order/settings persistence |
| `lib/actions/` | Auth, products, categories, checkout, payments, admin orders, settings, zones, staff mutations |
| `lib/validation.ts`, `lib/types.ts`, `lib/mappers.ts` | Validation, application models, database mapping |
| `lib/product-filters.ts`, `lib/category.ts`, `lib/navigation.ts` | Filter and routing/navigation conventions |
| `lib/angles.ts`, `lib/color.ts`, `lib/format.ts`, `lib/class-helpers.ts` | Image angle, colour, pricing, class helpers |
| `lib/store/`, `lib/supabase/` | Cart state and backend clients/auth helpers |
| `lib/payments/`, `lib/emails/`, `lib/whatsapp.ts` | Provider integration and receipts |
| `supabase/` | Local backend config, migrations, sample seed |
| `.agents/skills/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` | Coding-agent guidance rather than application runtime |
| `eslint.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts` | Lint, types, CSS, framework configuration |

Related documents: [README.md](README.md) is still largely starter instructions; [projectreview.md](projectreview.md) is an earlier detailed review; [progress.md](progress.md) records prior work. [docs/SETUP.md](docs/SETUP.md), [docs/DEPLOY.md](docs/DEPLOY.md), and [docs/HANDOVER.md](docs/HANDOVER.md) provide setup and operating notes. [docs/PAYMENTS_TODO.md](docs/PAYMENTS_TODO.md) and [docs/ADMIN_INTEGRATION_TODO.md](docs/ADMIN_INTEGRATION_TODO.md) contain plans that must be reconciled with current code.

Use this file as the consolidated current overview and treat the other documents as supporting/history references where they disagree. Update this file alongside route, schema, permission, payment, environment, or design-token changes. Keep secret credentials out of documentation. Before changing Next.js application code, follow `AGENTS.md` and read the relevant installed guides in `node_modules/next/dist/docs/`; this repository explicitly warns against assuming older Next conventions.
