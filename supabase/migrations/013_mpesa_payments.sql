-- ===========================================================================
-- 013_mpesa_payments.sql — payment reconciliation columns
-- ===========================================================================
-- Run this in the Supabase SQL Editor, or with the Supabase CLI:
--   supabase db push
--   supabase migration up
--
-- The M-Pesa callback cannot rely on "the most recent pending order": two
-- customers can be paying at the same time. Daraja gives every STK request a
-- unique CheckoutRequestID, so we store that and look the order up by it.
-- ===========================================================================

-- The identifier returned by /mpesa/stkpush/v1/processrequest.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_request_id text;

-- The final proof-of-payment reference: MpesaReceiptNumber for M-Pesa, or the
-- provider reference for a card payment.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;

-- Set when a callback/webhook confirms payment.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- A CheckoutRequestID belongs to exactly one STK request. The partial unique
-- index leaves existing rows (all NULL) alone while making the callback's
-- "look up one order" query safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_request_id
  ON orders (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

COMMENT ON COLUMN orders.checkout_request_id IS
  'Daraja CheckoutRequestID from the STK push; used to reconcile the callback.';
COMMENT ON COLUMN orders.payment_reference IS
  'Safaricom MpesaReceiptNumber or card-provider reference.';
COMMENT ON COLUMN orders.paid_at IS
  'Timestamp when the provider confirmed payment.';
