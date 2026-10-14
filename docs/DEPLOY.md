# Deployment Guide — Pedigree Leather

## Prerequisites

- **Supabase Cloud Project** (PostgreSQL + Auth + Storage)
- **Vercel Account** (or similar Next.js hosting)
- **Domain Name** (e.g., pedigreeleather.co.ke)
- **Twilio Account** (for WhatsApp notifications)
- **Sentry Account** (free tier for error tracking)

---

## 1. Supabase Cloud Setup

### 1.1 Create Project

1. Go to https://supabase.com/dashboard
2. Create new project
3. Note the **Project URL** and **anon/public key**
4. Go to **Settings → API** and copy the **service_role key** (keep secret!)

### 1.2 Run Migrations

```bash
# Link local to cloud
npx supabase link --project-ref <your-project-ref>

# Push all migrations
npx supabase db push
```

Or via Dashboard:
- Go to **SQL Editor**
- Run each migration in order: `001_initial.sql` through `009_delivery_zones.sql`
- Run `seed.sql` to populate products

### 1.3 Configure Auth

- **Authentication → Settings → Email**: Enable email confirmations
- **Authentication → URL Configuration**: Add your production URL to "Site URL"
- **Authentication → Providers**: Enable email/password

### 1.4 Create Admin User

1. Sign up a user in the app (or via Supabase Dashboard → Authentication → Users)
2. Note the email
3. In SQL Editor, run:
```sql
INSERT INTO admin_users (email, role, display_name)
VALUES ('your-email@example.com', 'owner', 'Your Name')
ON CONFLICT (email) DO NOTHING;
```

### 1.5 Storage Bucket

- Go to **Storage**
- Create bucket `product-images` (public)
- Add policies (see `supabase/migrations/002_storage.sql`)

---

## 2. Vercel Deployment

### 2.1 Connect Repository

1. Push to GitHub/GitLab
2. Import project in Vercel
3. Framework: Next.js (auto-detected)
4. Build Command: `pnpm build`
5. Output Directory: `.next` (default)

### 2.2 Environment Variables

Add **all** variables from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | From Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | From Supabase project settings (keep secret!) |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://your-domain.com` |
| `TWILIO_ACCOUNT_SID` | ⚠️ | For WhatsApp (Twilio Console) |
| `TWILIO_AUTH_TOKEN` | ⚠️ | For WhatsApp (Twilio Console) |
| `TWILIO_WHATSAPP_FROM` | ⚠️ | `whatsapp:+14155238886` (Twilio sandbox) |
| `SHOP_WHATSAPP_NUMBER` | ⚠️ | `+254791004004` (shop's WhatsApp) |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | From Sentry project settings |
| `SENTRY_AUTH_TOKEN` | ⚠️ | From Sentry (for source maps) |
| `SENTRY_ORG` | ⚠️ | From Sentry |
| `SENTRY_PROJECT` | ⚠️ | From Sentry |

⚠️ = Optional but recommended for production features

### 2.3 Build Settings

- Build Command: `pnpm build`
- Development Command: `pnpm dev`
- Install Command: `pnpm install`
- Node.js Version: 20.x (or 18.x)

---

## 3. Domain & SSL

### 3.1 DNS Records

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 (Vercel) |
| CNAME | www | cname.vercel-dns.com |

### 3.2 SSL

- Vercel provisions SSL automatically
- Wait for DNS propagation (5-60 min)
- Verify at `https://your-domain.com`

---

## 4. Post-Deploy Verification

### 4.1 Customer-Facing

- [ ] Homepage loads: `https://your-domain.com/`
- [ ] Bags listing: `https://your-domain.com/bags`
- [ ] Shoes listing: `https://your-domain.com/shoes`
- [ ] Product detail pages work
- [ ] Cart adds/removes items
- [ ] Checkout flow: form → payment → confirmation
- [ ] Order confirmation page shows correct data
- [ ] WhatsApp button opens correct number

### 4.2 Admin Panel

- [ ] Login at `https://your-domain.com/admin/login`
- [ ] Dashboard shows stats
- [ ] Products: list, create, edit, delete
- [ ] Orders: list, filter, detail, status updates
- [ ] Settings: shop info, delivery settings
- [ ] Zones: create, edit, delete, reorder
- [ ] Staff: add/remove team members

### 4.3 WhatsApp Notifications

- [ ] Place test order → check console for WhatsApp logs
- [ ] Update order status → check console for status notification
- [ ] Verify messages format correctly

### 4.4 SEO

- [ ] `https://your-domain.com/sitemap.xml` returns valid XML
- [ ] `https://your-domain.com/robots.txt` disallows `/admin`, `/checkout`
- [ ] Product pages have Open Graph tags
- [ ] View page source → meta tags present

### 4.5 Error Tracking

- [ ] Trigger error (e.g., visit `/admin/orders/invalid-uuid`)
- [ ] Check Sentry dashboard for error report
- [ ] Error boundaries render friendly messages

---

## 5. Monitoring & Maintenance

### 5.1 Supabase

- Monitor database size (free tier: 500MB)
- Set up backup schedule (Pro plan)
- Monitor API request limits

### 5.2 Vercel

- Check function execution time (Pro plan for longer)
- Monitor bandwidth usage
- Enable Vercel Analytics

### 5.3 Twilio WhatsApp

- Monitor message delivery rates
- Upgrade from sandbox to production when ready
- Verify message templates approved

### 5.4 Sentry

- Set up alerts for critical errors
- Configure source map uploads in CI/CD
- Review error trends weekly

---

## 6. Rollback Plan

If deployment breaks:

1. **Vercel**: Click "Promote to Production" on previous working deployment
2. **Supabase**: Migrations are idempotent; data rollback via backup
3. **DNS**: Point back to old hosting if needed

---

## 7. Support Contacts

| Service | Support |
|---------|---------|
| Supabase | https://supabase.com/support |
| Vercel | https://vercel.com/support |
| Twilio | https://support.twilio.com |
| Sentry | https://sentry.io/support |
| Domain registrar | Your registrar's support |

---

## Quick Commands Reference

```bash
# Local development
pnpm dev
pnpm build --webpack
pnpm lint
npx tsc --noEmit

# Supabase
npx supabase start
npx supabase db reset
npx supabase db push
npx supabase gen types typescript --local > lib/supabase/types.ts

# Sentry (when DSN available)
npx @sentry/wizard@latest -i nextjs

# Deploy
git push origin main
# Vercel auto-deploys
```