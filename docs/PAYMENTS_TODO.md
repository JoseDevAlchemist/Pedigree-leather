# Payment Integration — TODO

This document lists what is needed to replace the payment STUB with real M-Pesa and Flutterwave
integrations. The current flow (Session 6) builds the complete checkout → payment → confirmation
journey with a stub `markPaymentMethodAction` that only writes `payment_method` to the order.

## Session 7 — Admin Orders & Customer Tracking (Completed)

- **Admin orders list** (`/admin/orders`): filtering by status, search by order #/phone/name, pagination, click to detail.
- **Admin order detail** (`/admin/orders/[id]`): customer info, delivery info, items, totals, payment info, status timeline with history, status update controls (owner: any status; worker: forward only + cancel only from pending/paid), cancel dialog with reason.
- **Admin dashboard order stats**: pending payment count, to prepare count, out for delivery today count, recent orders (last 5).
- **Customer order tracking** (`/order/[orderId]`): status timeline with timestamps from `order_status_history`, delivery/pickup info, payment status, manual "Refresh status" button, auto-refresh every 30 seconds.
- **Status labels**: different labels for delivery vs pickup (e.g., "Ready to ship" vs "Ready for pickup", "Out for delivery" vs "Picked up").
- **Server actions**: `updateOrderStatusAction`, `cancelOrderAction` in `lib/actions/orders-admin.ts` with role-based validation.

All payment integration work below remains to be done.

---

## M-Pesa (Daraja API — Safaricom)

### Required credentials
| Credential | Description | Where it lives |
|------------|-------------|----------------|
| `MPESA_CONSUMER_KEY` | Daraja API consumer key | `.env.local` (never committed) |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret | `.env.local` |
| `MPESA_PASSKEY` | Lipa na M-Pesa Online passkey (Base64 encoded) | `.env.local` |
| `MPESA_SHORTCODE` | Paybill or Till number (e.g., `174379` for sandbox) | `.env.local` |
| `MPESA_CALLBACK_URL` | Public HTTPS URL for STK push results (e.g., `https://pedigreeleather.co/api/mpesa/callback`) | `.env.local` |

> **Sandbox vs Production**: Daraja sandbox uses a fixed shortcode (`174379`) and test passkey.
> Production requires a registered paybill/till and a generated passkey. Keep both sets of credentials
> and switch via an env flag (`MPESA_ENV=sandbox|production`).

### Implementation steps

1. **Add credentials to `.env.local`**
   ```
   MPESA_CONSUMER_KEY=...
   MPESA_CONSUMER_SECRET=...
   MPESA_PASSKEY=...
   MPESA_SHORTCODE=174379
   MPESA_CALLBACK_URL=https://your-domain.vercel.app/api/mpesa/callback
   MPESA_ENV=sandbox
   ```

2. **Create `lib/mpesa.ts` (server-only)**
   - `getAccessToken()`: POST to `/oauth/v1/generate?grant_type=client_credentials` with Basic auth
   - `stkPush(phone, amount, orderNumber)`: POST to `/mpesa/stkpush/v1/processrequest`
     - `BusinessShortCode`, `Password` (Base64 of `Shortcode+Passkey+Timestamp`), `Timestamp`,
       `TransactionType=CustomerPayBillOnline`, `Amount`, `PartyA` (customer phone in `254...`),
       `PartyB` (shortcode), `PhoneNumber`, `CallBackURL`, `AccountReference` (order number),
       `TransactionDesc`
   - Returns `CheckoutRequestID` — store this on the order for reconciliation

3. **Update `lib/actions/orders.ts`**
   - In `markPaymentMethodAction`, when `method === "mpesa"`:
     - Call `stkPush(customerPhone, orderTotal, orderNumber)`
     - Save `checkoutRequestId` to `orders.payment_reference` (add column if needed)
     - Return `{ ok: true, checkoutRequestId }` so the client can poll or show "waiting for prompt"

4. **Create callback handler** — `app/api/mpesa/callback/route.ts`
   - POST from Daraja with `Body.stkCallback`
   - Verify `ResultCode === 0` (success) or handle failures (`1032` = cancelled, `1` = insufficient funds, etc.)
   - Extract `CheckoutRequestID`, `MpesaReceiptNumber`, `TransactionDate`
   - Update `orders`:
     - `payment_status = 'paid'`
     - `payment_method = 'mpesa'`
     - `payment_reference = MpesaReceiptNumber`
     - `status = 'confirmed'`
   - Respond with `200 OK` and JSON `{ ResultCode: 0, ResultDesc: "Accepted" }` (Daraja requires this)

5. **Add `payment_reference` column to orders** (migration)
   ```sql
   ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
   ```

6. **Client-side UX**
   - On `/payment/[orderId]`, after selecting M-Pesa and clicking "Confirm order":
     - Show "Check your phone for the M-Pesa prompt" with a spinner
     - Poll `/api/orders/[orderId]` every 3s until `payment_status === 'paid'` (max 2 min)
     - On success → redirect to `/order/[orderId]`
     - On timeout → show "Payment pending. Check WhatsApp for confirmation." with a "Check status" button

---

## Card Payments (Flutterwave)

### Required credentials
| Credential | Description | Where it lives |
|------------|-------------|----------------|
| `FLUTTERWAVE_PUBLIC_KEY` | Client-side key (safe in browser) | `.env.local` (or `NEXT_PUBLIC_` prefix) |
| `FLUTTERWAVE_SECRET_KEY` | Server-side key | `.env.local` |
| `FLUTTERWAVE_WEBHOOK_HASH` | Secret for verifying webhook signatures | `.env.local` |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Optional, for card tokenization | `.env.local` |

### Implementation steps

1. **Add credentials to `.env.local`**
   ```
   FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
   FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
   FLUTTERWAVE_WEBHOOK_HASH=...
   ```

2. **Create `lib/flutterwave.ts` (server-only)**
   - `initializePayment(data)`: POST to `/v3/payments`
     - `tx_ref`: order number (e.g., `PED-2026-0001`)
     - `amount`: order total
     - `currency`: `KES`
     - `redirect_url`: `${SHOP_URL}/order/[orderId]?payment=flutterwave`
     - `customer`: email, phone, name
     - `customizations`: title, logo, description
     - `meta`: order_id (UUID)
   - Returns `link` (hosted checkout URL) — redirect the browser there

3. **Update `lib/actions/orders.ts`**
   - In `markPaymentMethodAction`, when `method === "card"`:
     - Call `initializePayment(...)`
     - Return `{ ok: true, redirectUrl }`
   - Client receives `redirectUrl` and does `window.location.href = redirectUrl`

4. **Create webhook handler** — `app/api/flutterwave/webhook/route.ts`
   - POST from Flutterwave
   - Verify signature: `hash_hmac('sha256', payload, FLUTTERWAVE_WEBHOOK_HASH)` === `x-flw-signature` header
   - Check `event === 'charge.completed'` and `data.status === 'successful'`
   - Extract `tx_ref` (order number), `flw_ref`, `amount`, `currency`
   - Update `orders` where `order_number = tx_ref`:
     - `payment_status = 'paid'`
     - `payment_method = 'card'`
     - `payment_reference = flw_ref`
     - `status = 'confirmed'`
   - Respond `200 OK`

5. **Add `payment_reference` column** (same migration as M-Pesa)

6. **Client-side UX**
   - On `/payment/[orderId]`, selecting "Pay with card" → "Confirm order":
     - Call `markPaymentMethodAction` → get `redirectUrl`
     - `window.location.href = redirectUrl` (full redirect to Flutterwave hosted page)
   - After payment, Flutterwave redirects to `/order/[orderId]?payment=flutterwave`
   - Confirmation page detects `payment_status === 'paid'` and shows "Paid" badge

---

## Pay on Delivery / Pay at Shop

Already implemented as a stub — no external integration needed.
- `payment_method = 'pay_on_delivery'` (delivery) or `'pay_on_delivery'` (pickup, same value)
- `payment_status` remains `'pending'` until driver/shop marks it paid
- Admin will need a "Mark as paid" action in the order detail view

---

## WhatsApp Order Confirmation (Deferred)

### Required credentials
| Credential | Description | Where it lives |
|------------|-------------|----------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `.env.local` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `.env.local` |
| `TWILIO_WHATSAPP_FROM` | WhatsApp-enabled Twilio number (e.g., `whatsapp:+14155238886`) | `.env.local` |

> Alternative: Meta Cloud API (WhatsApp Business API) — needs `WHATSAPP_ACCESS_TOKEN`,
> `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`.

### Implementation
- Create `lib/whatsapp.ts` with `sendOrderConfirmation(order)`
- Trigger from `createOrder` in `lib/orders-api.ts` after successful order creation
- Template: "Hi {name}, your order #{order_number} for KES {total} is confirmed. {delivery/pickup details}. Track: {order_url}"

---

## Database Changes Needed

Run these migrations before integrating real payments:

```sql
-- 005_payments.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Optional: webhook log for debugging
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('mpesa', 'flutterwave')),
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Testing Checklist

| Scenario | M-Pesa | Card | Pay on Delivery |
|----------|--------|------|-----------------|
| Successful payment | STK push → enter PIN → callback → paid | Redirect → pay → webhook → paid | Driver marks paid in admin |
| Cancelled by user | STK push → cancel → callback (1032) | Close Flutterwave tab → no webhook | N/A |
| Insufficient funds | STK push → fail (1) | Card declined → webhook (failed) | N/A |
| Network timeout | Poll order status → manual retry | Flutterwave handles retry | N/A |
| Refund | Manual via Daraja portal | Flutterwave dashboard | N/A |

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/shop-config.ts` | Add payment provider config flags |
| `lib/orders-api.ts` | Trigger WhatsApp confirmation, store payment_reference |
| `lib/actions/orders.ts` | Replace `markPaymentMethodAction` STUB with real calls |
| `app/(shop)/payment/[orderId]/page.tsx` | Handle redirect/polling for M-Pesa, redirect for Card |
| `app/(shop)/order/[orderId]/page.tsx` | Show real payment status from webhook updates |
| `app/api/mpesa/callback/route.ts` | New — M-Pesa STK callback |
| `app/api/flutterwave/webhook/route.ts` | New — Flutterwave charge webhook |
| `supabase/migrations/005_payments.sql` | New — payment_reference, paid_at, webhook log |

---

## Security Notes

- **Never log** full card details, M-Pesa PINs, or webhook payloads with sensitive data
- **Verify webhook signatures** (Flutterwave) and **callback authenticity** (M-Pesa)
- **Idempotency**: Use `tx_ref` / `CheckoutRequestID` to prevent duplicate processing
- **Rate limiting**: Add middleware on callback/webhook routes
- **Audit trail**: Log every payment state change in `payment_webhooks` table

---

## Timeline Estimate

| Task | Effort |
|------|--------|
| M-Pesa STK push + callback | 2–3 days |
| Flutterwave hosted checkout + webhook | 1–2 days |
| WhatsApp confirmation (Twilio) | 1 day |
| Testing (sandbox + edge cases) | 2 days |
| **Total** | **~1 week** |

---

## Notes

- The current STUB in `lib/actions/orders.ts` (`markPaymentMethodAction`) is the **only** place
  that needs to change for each provider. The checkout → payment → confirmation flow is complete.
- `orders.payment_method` values: `'mpesa'`, `'card'`, `'pay_on_delivery'`
- `orders.payment_status` values: `'pending'`, `'paid'`, `'failed'`, `'refunded'`
- All amounts are **integers in KES** (no decimals) — Flutterwave expects the same