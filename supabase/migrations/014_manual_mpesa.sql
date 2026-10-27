-- ===========================================================================
-- 014_manual_mpesa.sql — allow the manual Till payment method
-- ===========================================================================
-- Run this in the Supabase SQL Editor, or with the Supabase CLI:
--   supabase db push
--   supabase migration up
--
-- The checkout now offers two M-Pesa paths:
--   * mpesa         — Daraja STK push, reconciled by CheckoutRequestID
--   * mpesa_manual  — shopper pays the Till and submits the SMS confirmation
--                     code, which is stored in orders.payment_reference (013)
-- ===========================================================================

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('mpesa', 'mpesa_manual', 'card', 'pay_on_delivery')
  );

COMMENT ON COLUMN orders.payment_method IS
  'mpesa (STK), mpesa_manual (Till + confirmation code), card, or pay_on_delivery.';
