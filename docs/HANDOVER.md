# Handover Document — Pedigree Leather

## Project Overview

**Pedigree Leather** is a full-stack Next.js e-commerce application for handcrafted leather bags and shoes, built with:

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, custom design tokens
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: M-Pesa STK Push (stub), Flutterwave (stub), Pay on Delivery
- **Notifications**: Twilio WhatsApp Business API
- **Error Tracking**: Sentry
- **Hosting**: Vercel

---

## Admin Access

### Login

1. Go to `/admin/login`
2. Use the owner email configured in `admin_users` table
3. After login, you'll see the dashboard at `/admin`

### Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access: products, orders, settings, zones, staff, dashboard |
| **Worker** | Orders only: view, update status (forward only), cancel (pending/paid only) |

---

## Common Tasks

### Add a Product

1. Go to `/admin/products`
2. Click "Add product"
3. Fill in:
   - **Name**: Product title (e.g., "Karura Tote")
   - **Slug**: Auto-generated from name, editable
   - **Category**: Bag or Shoe
   - **Description**: Product details
   - **Base Price**: In KES (e.g., 18500)
   - **Discount %**: Optional (e.g., 10 for 10% off)
   - **Stock Quantity**: Total units available
   - **Featured**: Show on homepage featured rail
   - **Active**: Visible in shop
4. Add color variants:
   - Click "Add colour"
   - Name (e.g., "Cognac"), Hex code (e.g., `#8B4513`)
5. Upload images for each colour × angle:
   - Bags: front, side-left, side-right, top, back (5 angles)
   - Shoes: front, laces, side, back, bottom (5 angles)
6. Click "Save product"

### Edit a Product

1. Go to `/admin/products`
2. Click the product row or "Edit" button
3. Modify fields
4. Save

### Delete a Product

1. Go to `/admin/products`
2. Click the trash icon
3. Confirm deletion (cascades: colors, images, order items preserved)

---

### Process an Order

1. Go to `/admin/orders`
2. Filter by status: "Pending payment", "Paid", etc.
3. Click an order to view details
4. Update status using the buttons:
   - **Owner**: Can set any status
   - **Worker**: Can only move forward (pending → paid → preparing → ready → out → delivered)
5. Add a note (optional)
6. Status change triggers WhatsApp to customer

### Cancel an Order

1. Open order detail
2. Click "Cancel order"
3. Enter reason (required)
4. Confirm
6. Only allowed for Owner, or Worker if status is "pending_payment" or "paid"

### View Order Details

- Customer info (name, phone, email)
- Delivery method & address
- Items with colors, quantities, prices
- Payment method & status
- Status timeline with history
- Order totals

---

### Manage Delivery Zones

1. Go to `/admin/settings` → "Manage zones"
2. **Add zone**: Name, Fee (KES), Sort order
3. **Edit zone**: Click edit, modify fee/status/order
4. **Delete zone**: Click trash, confirm
5. **Reorder**: Use up/down arrows
6. Zones appear in checkout dropdown when delivery is selected

### Update Shop Settings

1. Go to `/admin/settings` (Owner only)
2. **Shop info**: Name, phone, WhatsApp, email, address, Google Maps URL
3. **Delivery**: Flat rate, free delivery threshold, pickup toggle
4. Save each section independently

---

## Shop Configuration

All shop settings are stored in the `shop_settings` table and editable via `/admin/settings`.

### Default Values

| Setting | Default |
|---------|---------|
| Shop name | Pedigree Leather |
| Phone | +254143354741 |
| WhatsApp | 254143354741 |
| Email | hello@pedigree.co.ke |
| Address | Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya |
| Delivery flat rate | KES 300 |
| Free delivery threshold | KES 25,000 |
| Pickup available | Yes |

### Updating

- Changes take effect immediately (cache revalidated on save)
- Customer-facing pages fetch from API, not hardcoded
- Checkout uses current settings for fees

---

## WhatsApp Notifications

### Setup

1. Create Twilio account
2. Get Account SID, Auth Token from Console
3. Configure WhatsApp sandbox: `whatsapp:+14155238886`
4. Add sandbox number to Twilio Console
5. Set environment variables (see DEPLOY.md)

### Message Templates

| Trigger | Recipient | Template |
|---------|-----------|----------|
| New order | Shop owner | "New order {order_number} — {customer} — KES {total} — {method}. {items}" |
| Order received | Customer | "Hi {name}, your order {order_number} received. Total: KES {total}. We'll WhatsApp when ready." |
| Status: paid | Customer | "Payment confirmed. We're preparing your order." |
| Status: preparing | Customer | "Your order is being prepared." |
| Status: ready_for_delivery | Customer | "Your order is ready for delivery." (or pickup) |
| Status: out_for_delivery | Customer | "Your order is on the way." |
| Status: delivered | Customer | "Your order has been delivered. Thank you!" |
| Status: cancelled | Customer | "Your order has been cancelled." |

### Dev Mode

Without Twilio credentials, messages log to console instead of sending.

---

## Order Status Flow

```
pending_payment → paid → preparing → ready_for_delivery → out_for_delivery → delivered
                      ↘ cancelled (any time by owner, pending/paid by worker)
```

**Pickup orders skip**: `out_for_delivery` (goes ready → delivered)

---

## File Structure Highlights

```
app/
├── (shop)/                    # Customer-facing routes
│   ├── page.tsx              # Homepage
│   ├── bags/[slug]/          # Bag product pages
│   ├── shoes/[slug]/         # Shoe product pages
│   ├── checkout/             # Checkout page
│   ├── payment/[orderId]/    # Payment method selection
│   └── order/[orderId]/      # Order confirmation + tracking
├── (admin)/admin/            # Admin panel
│   ├── page.tsx              # Dashboard
│   ├── products/             # Product CRUD
│   ├── orders/               # Order management
│   ├── settings/             # Shop settings
│   └── staff/                # Team management
├── api/                      # API routes
│   ├── shop-config/          # Public shop config
│   ├── delivery-zones/       # Active zones for checkout
│   └── orders/[orderId]/     # Order fetch (guest access)
components/
├── admin/                    # Admin components
├── shop/                     # Shop components
├── product/                  # Product components
├── cart/                     # Cart drawer
└── layout/                   # Navbar, Footer, WhatsApp button
lib/
├── actions/                  # Server actions
│   ├── orders.ts             # Create order, mark payment
│   ├── orders-admin.ts       # Update status, cancel
│   ├── settings.ts           # Shop settings
│   └── zones.ts              # Delivery zones
├── api.ts                    # Public product API
├── admin-api.ts              # Admin product API
├── orders-api.ts             # Order DB operations
├── settings-api.ts           # Shop settings DB
├── whatsapp.ts               # WhatsApp notifications
├── shop-config.ts            # Config + getShopConfig()
└── supabase/                 # Supabase clients
supabase/migrations/          # Database schema
```

---

## Key Conventions

### Design Tokens

- Colors: `--pedigree-brown` (#5D4037), `--pedigree-brown-dark` (#4A332B)
- Use semantic tokens: `bg-primary`, `text-accent`, `bg-card`, `border-border`
- No raw hex in components

### Responsive

- Mobile-first: `px-4`, `sm:px-6`, `lg:px-8`
- Buttons: full-width mobile, auto desktop
- Tables: stacked cards on mobile, overflow-x-auto on desktop

### Server vs Client

- Server Components by default
- `'use client'` only for interactivity
- Server Actions for mutations
- API routes for public data (shop config, zones)

### Database

- Service role only in `lib/supabase/admin.ts` (server-only)
- Public reads use `lib/supabase/public.ts` (no cookies → static)
- Admin reads use `lib/supabase/server.ts` (cookie-aware)

### TypeScript

- Strict mode enabled
- Run `npx tsc --noEmit` before commit
- No `any`, no `@ts-ignore`

---

## Troubleshooting

### "Database not ready" in admin

- Run `npx supabase db push` to apply migrations
- Check Supabase Dashboard → Tables exist

### Build fails on Vercel but works locally

- Check all env vars are set in Vercel
- Run `pnpm build --webpack` locally (Turbopack font bug)

### Cart not persisting

- Check localStorage key `pedigree-cart`
- Zustand store in `lib/store/cart.ts`

### WhatsApp not sending

- Verify Twilio credentials
- Check console for dev mode logs
- Ensure sandbox number is joined

### Admin login redirect loop

- Check user exists in `admin_users` table
- Verify role is 'owner' or 'worker'

---

## Support Contacts

| Area | Contact |
|------|---------|
| Code/Architecture | Lead developer |
| Supabase | Project owner via Supabase Dashboard |
| Vercel | Project owner via Vercel Dashboard |
| Twilio | Account owner via Twilio Console |
| Sentry | Project owner via Sentry.io |

---

## Next Steps for Production

1. [ ] Apply migrations to cloud Supabase
2. [ ] Create owner admin user in cloud
3. [ ] Add all env vars to Vercel
4. [ ] Connect custom domain
5. [ ] Test full order flow in production
6. [ ] Configure Twilio production WhatsApp
7. [ ] Add Sentry DSN
8. [ ] Set up monitoring alerts